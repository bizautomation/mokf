/**
 * MOKF — reference implementation (standalone, zero dependencies).
 *
 * MOKF is a *profile* of the Open Knowledge Format (OKF v0.1, Google Cloud,
 * github.com/GoogleCloudPlatform/knowledge-catalog): standard OKF concept files,
 * plus a `manifest.json` extension that carries the two things OKF v0.1 leaves
 * open — sibling order and explicit relational edges (the DAG).
 *
 * This file is the normative reference for the round-trip: a bundle exported to
 * MOKF and re-imported must reproduce the same nodes, edges, and concept bodies.
 * It operates on a plain in-memory model (below) — no database, no framework.
 *
 * License: Apache-2.0.
 */

export const OKF_VERSION = "0.1";
export const MOKF_VERSION = "0.1";

// ---------------------------------------------------------------------------
// The in-memory bundle model a producer maps to/from.
// ---------------------------------------------------------------------------

/** A concept type: bundle | section | record | text | package | quotes | … (open). */
export type OkfType = string;

/** A node: a stable handle with a frozen slug and an optional backing concept. */
export interface Node {
  key: string;            // stable identity (any opaque string)
  slug: string;           // path segment, [a-z0-9-]; frozen
  type: OkfType;          // OKF `type`
  status?: string | null;
  conceptId?: string | null; // → a Concept (its body/tags/timestamp); null ⇒ a structural folder
}

/** An edge: parent→child, ordered by position; `contains` = canonical home. */
export interface Edge {
  parent: string;         // parent node key
  child: string;          // child node key
  position: number;
  relation: "contains" | "reference";
}

/** The backing content for a memory-backed node. */
export interface Concept {
  id: string;
  text: string;           // the verbatim body
  tags?: string[];
  timestamp?: string;     // ISO 8601
  resource?: string;      // a URI; defaults to mokf://concept/<id>
  title?: string;         // optional explicit title (else derived from first body line)
  description?: string;
}

/** A whole bundle: nodes + edges + a concept store + the root node key. */
export interface Bundle {
  rootKey: string;
  nodes: Node[];
  edges: Edge[];
  concepts: Record<string, Concept>;
  /** Folder (mem-less node) title/description, by node key. */
  folderMeta?: Record<string, { title: string; description: string }>;
}

// ---------------------------------------------------------------------------
// Archive + manifest types
// ---------------------------------------------------------------------------

export interface ManifestNode {
  nodeKey: string; slug: string; path: string; type: OkfType;
  status: string | null; conceptId: string | null; file: string;
}
export interface ManifestEdge {
  parent: string; child: string; position: number; relation: "contains" | "reference";
}
export interface Manifest {
  mokf_version: string; okf_version: string; exportedAt: string;
  root: { slug: string; nodeKey: string };
  nodes: ManifestNode[]; edges: ManifestEdge[];
}
export interface Archive {
  /** archive-relative path → file contents (UTF-8). */
  files: Record<string, string>;
  manifest: Manifest;
}

// ---------------------------------------------------------------------------
// YAML frontmatter (minimal — scalars + block-style lists; matches GCP output)
// ---------------------------------------------------------------------------

type FmValue = string | number | null | undefined | string[];

function yamlScalar(v: string | number): string {
  if (typeof v === "number") return String(v);
  return JSON.stringify(String(v).replace(/\r?\n/g, " ")); // a JSON string is a valid YAML double-quoted scalar
}

export function buildFrontmatter(fields: Record<string, FmValue>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) { lines.push(`${k}:`); for (const x of v) lines.push(`- ${yamlScalar(x)}`); }
    else lines.push(`${k}: ${yamlScalar(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

export function parseFrontmatter(text: string): { fields: Record<string, string | string[]>; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fields: {}, body: text };
  const fields: Record<string, string | string[]> = {};
  const unquote = (t: string): string => {
    const s = t.trim();
    if (s.startsWith('"')) { try { return JSON.parse(s) as string; } catch { return s; } }
    return s;
  };
  const lines = m[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i].indexOf(":");
    if (c < 0) continue;
    const key = lines[i].slice(0, c).trim();
    const raw = lines[i].slice(c + 1).trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      const inner = raw.slice(1, -1).trim();
      fields[key] = inner ? inner.split(",").map(unquote) : [];
    } else if (raw === "") {
      const items: string[] = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) items.push(unquote(lines[++i].replace(/^\s*-\s+/, "")));
      fields[key] = items;
    } else fields[key] = unquote(raw);
  }
  return { fields, body: m[2] ?? "" };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const titleFromBody = (text: string): string => {
  const first = text.split("\n").find(l => l.trim()) || "";
  return first.replace(/^#+\s*/, "").replace(/\*+/g, "").slice(0, 140);
};

export function exportMokf(bundle: Bundle, exportedAt: string): Archive {
  const nodeByKey = new Map(bundle.nodes.map(n => [n.key, n]));
  const childrenOf = (k: string, rel: "contains" | "reference"): Edge[] =>
    bundle.edges.filter(e => e.parent === k && e.relation === rel).sort((a, b) => a.position - b.position);

  const files: Record<string, string> = {};
  const manifestNodes: ManifestNode[] = [];
  const manifestEdges: ManifestEdge[] = [];
  const pathByKey = new Map<string, string>();
  const titleByKey = new Map<string, string>();

  interface C { key: string; path: string; file: string; fm: Record<string, FmValue>; body: string;
    title: string; description: string; isContent: boolean; childKeys: string[]; refKeys: string[]; }
  const collected: C[] = [];

  const walk = (key: string, parentPath: string, seen: Set<string>): void => {
    if (seen.has(key)) return; seen.add(key);
    const node = nodeByKey.get(key); if (!node) return;
    const path = parentPath ? `${parentPath}/${node.slug}` : node.slug;
    pathByKey.set(key, path);
    const kids = childrenOf(key, "contains");
    const isContent = node.conceptId != null;

    let body = "", title = node.slug, description = "";
    const fm: Record<string, FmValue> = { type: node.type, status: node.status ?? undefined, slug: node.slug, nodeKey: node.key };
    if (isContent) {
      const concept = bundle.concepts[node.conceptId as string];
      body = concept ? concept.text : "";
      if (concept) {
        fm.resource = concept.resource || `mokf://concept/${concept.id}`;
        if (concept.tags?.length) fm.tags = concept.tags;
        if (concept.timestamp) fm.timestamp = concept.timestamp;
        title = concept.title || titleFromBody(body); fm.title = title;
        if (concept.description) { fm.description = concept.description; description = concept.description; }
      }
    } else {
      const meta = bundle.folderMeta?.[key];
      if (meta) { fm.title = meta.title; fm.description = meta.description; title = meta.title; description = meta.description; }
    }
    titleByKey.set(key, title);

    collected.push({ key, path, file: `${path}.md`, fm, body, title, description, isContent,
      childKeys: kids.map(e => e.child), refKeys: childrenOf(key, "reference").map(r => r.child) });

    manifestNodes.push({ nodeKey: node.key, slug: node.slug, path, type: node.type,
      status: node.status ?? null, conceptId: node.conceptId ?? null, file: `${path}.md` });
    for (const e of kids) manifestEdges.push({ parent: e.parent, child: e.child, position: e.position, relation: "contains" });
    for (const r of childrenOf(key, "reference")) manifestEdges.push({ parent: r.parent, child: r.child, position: r.position, relation: "reference" });

    for (const e of kids) walk(e.child, path, seen);
  };
  walk(bundle.rootKey, "", new Set());

  // emit pass — all paths known, so body relationship links + listings resolve.
  for (const c of collected) {
    let body = c.body;
    // A structural folder (no backing concept) gets a readable body — its title
    // as a heading + its description — so the .md isn't just a bare metadata
    // table. Derived from frontmatter, so it's stripped on import (round-trip).
    if (!c.isContent) {
      body = `# ${c.title}`;
      if (c.description) body += `\n\n${c.description}`;
    }
    const refLinks = c.refKeys.map(rk => ({ t: titleByKey.get(rk) || rk, p: pathByKey.get(rk) }))
      .filter(x => x.p).map(x => `- [${x.t}](/${x.p}.md)`);
    if (refLinks.length) body = `${body}${body ? "\n\n" : ""}# Related\n${refLinks.join("\n")}`;
    files[c.file] = `${buildFrontmatter(c.fm)}\n\n${body}\n`;

    if (c.childKeys.length) {
      const lines = [`# ${c.title}`, ""];
      for (const ck of c.childKeys) {
        const cc = collected.find(x => x.key === ck); if (!cc) continue;
        const leaf = cc.file.split("/").pop();
        lines.push(`* [${cc.title}](${leaf})${cc.description ? ` - ${cc.description}` : ""}`);
      }
      files[`${c.path}/index.md`] = lines.join("\n") + "\n";
    }
  }

  const root = nodeByKey.get(bundle.rootKey)!;
  const manifest: Manifest = {
    mokf_version: MOKF_VERSION, okf_version: OKF_VERSION, exportedAt,
    root: { slug: root.slug, nodeKey: root.key }, nodes: manifestNodes, edges: manifestEdges,
  };
  files["manifest.json"] = JSON.stringify(manifest, null, 2) + "\n";
  // archive-root listing (OKF reserved): okf_version + full TOC, no concept frontmatter.
  const idx = [`---\nokf_version: "${OKF_VERSION}"\n---`, "", "# Bundle Index", ""];
  for (const n of manifestNodes) {
    const depth = n.path.split("/").length - 1;
    idx.push(`${"  ".repeat(depth)}- [${n.slug}](/${n.file})${n.status ? ` _(${n.type}, ${n.status})_` : ` _(${n.type})_`}`);
  }
  files["index.md"] = idx.join("\n") + "\n";

  return { files, manifest };
}

// ---------------------------------------------------------------------------
// Import (manifest-driven; idempotent) → reconstructs a Bundle
// ---------------------------------------------------------------------------

export function importMokf(archive: Archive, now: string): Bundle {
  const { files, manifest } = archive;
  const str = (v: string | string[] | undefined): string | undefined => Array.isArray(v) ? v.join(" ") : v;
  const nodes: Node[] = [];
  const concepts: Record<string, Concept> = {};
  const folderMeta: Record<string, { title: string; description: string }> = {};

  for (const mn of manifest.nodes) {
    const parsed = files[mn.file] ? parseFrontmatter(files[mn.file]) : { fields: {} as Record<string, string | string[]>, body: "" };
    const isContent = mn.conceptId != null;
    if (isContent) {
      // strip the export packaging + the derived `# Related` link block
      let body = parsed.body.replace(/^\n/, "").replace(/\n$/, "");
      body = body.replace(/\n*# Related\n(?:- \[[^\]]*\]\([^)]*\)\n?)+$/, "");
      const id = mn.conceptId as string;
      concepts[id] = {
        id, text: body,
        tags: Array.isArray(parsed.fields.tags) ? parsed.fields.tags : undefined,
        timestamp: str(parsed.fields.timestamp) || now,
        resource: str(parsed.fields.resource),
        title: str(parsed.fields.title),
        description: str(parsed.fields.description),
      };
    } else {
      folderMeta[mn.nodeKey] = { title: str(parsed.fields.title) ?? mn.slug, description: str(parsed.fields.description) ?? "" };
    }
    nodes.push({ key: mn.nodeKey, slug: mn.slug, type: (str(parsed.fields.type) || mn.type) as OkfType,
      status: (str(parsed.fields.status) ?? mn.status) || null, conceptId: mn.conceptId });
  }

  return { rootKey: manifest.root.nodeKey, nodes, edges: manifest.edges.map(e => ({ ...e })), concepts, folderMeta };
}

// ---------------------------------------------------------------------------
// Round-trip conformance check
// ---------------------------------------------------------------------------

/** Render a bundle to a canonical string (the comparison surface for round-trip).
 *  Walks `contains` order; each concept body verbatim. Pure, deterministic. */
export function renderBundle(bundle: Bundle): string {
  const nodeByKey = new Map(bundle.nodes.map(n => [n.key, n]));
  const out: string[] = [];
  const walk = (key: string, depth: number, seen: Set<string>) => {
    if (seen.has(key)) return; seen.add(key);
    const n = nodeByKey.get(key); if (!n) return;
    const title = n.conceptId ? (bundle.concepts[n.conceptId]?.text.split("\n").find(l => l.trim()) || n.slug)
      : (bundle.folderMeta?.[key]?.title || n.slug);
    out.push(`${"#".repeat(Math.min(depth + 1, 6))} ${title}`);
    if (n.conceptId && bundle.concepts[n.conceptId]) {
      const rest = bundle.concepts[n.conceptId].text.split("\n").slice(1).join("\n").trim();
      if (rest) out.push(rest);
    }
    bundle.edges.filter(e => e.parent === key && e.relation === "contains")
      .sort((a, b) => a.position - b.position).forEach(e => walk(e.child, depth + 1, seen));
  };
  walk(bundle.rootKey, 0, new Set());
  return out.join("\n\n");
}

export interface RoundTripResult { identical: boolean; original: string; roundTrip: string; firstDiffAt: number; }

/** export → import → render, compared to the original render. The conformance gate. */
export function roundTrip(bundle: Bundle, now = "1970-01-01T00:00:00.000Z"): RoundTripResult {
  const original = renderBundle(bundle);
  const reimported = importMokf(exportMokf(bundle, now), now);
  const roundTrip = renderBundle(reimported);
  let firstDiffAt = -1;
  for (let i = 0; i < Math.max(original.length, roundTrip.length); i++) {
    if (original[i] !== roundTrip[i]) { firstDiffAt = i; break; }
  }
  return { identical: firstDiffAt === -1 && original.length === roundTrip.length, original, roundTrip, firstDiffAt };
}
