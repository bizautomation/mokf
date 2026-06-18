# MOKF — Muninn's OKF profile (OKF v0.1 + a manifest extension)

**MOKF is not a new format.** Muninn exports bundles as **OKF v0.1** — the Open
Knowledge Format published by Google Cloud
([GoogleCloudPlatform/knowledge-catalog → `okf/SPEC.md`](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)),
a "universal, vendor-neutral format for representing knowledge as plain markdown
files with YAML frontmatter." MOKF (= "Muninn OKF") is just the nickname for
*Muninn's profile of OKF*: standard OKF concept files, **plus** one Muninn
extension — a `manifest.json` — that carries the two things OKF v0.1
deliberately does not specify: **sibling order** and **explicit relational
edges** (the bundle DAG).

A generic OKF consumer (git, a static file server, another agent) reads a MOKF
export as ordinary OKF and gets every concept's content and links. A Muninn
consumer additionally reads `manifest.json` and recovers exact order + the
node/edge graph, so the bundle **round-trips losslessly**:
`export → import → render` is byte-identical to the original bundle render
(see the conformance gate in `reference/roundtrip.test.ts`).

> Model: a **bundle** is relational structure over concepts — **nodes** (a frozen
> `slug`, an optional backing concept; no concept ⇒ a structural folder) joined
> by **edges** (a `position` and a `relation`: `contains` = the one canonical
> home, `reference` = a non-home cross-link). A MOKF archive is the OKF
> projection of that graph. Muninn is the reference producer; any system with the
> same node/edge model can emit MOKF.

---

## 1. What OKF v0.1 requires (and what it leaves open)

From the OKF v0.1 spec, the parts that bind us:

- **Concept files** are `.md` with YAML frontmatter + a markdown body. The one
  **required** frontmatter key is **`type`**. Recommended keys, in priority
  order: `title`, `description`, `resource` (a URI for the underlying asset),
  `tags` (a YAML list), `timestamp` (ISO 8601). Producers MAY add any other
  keys; consumers MUST preserve unknown keys.
- **Reserved filenames** (never a concept document): **`index.md`** (a directory
  listing for progressive disclosure, *no frontmatter*) and **`log.md`** (a
  chronological history, no frontmatter).
- **Relationships are expressed as standard markdown links in the body** —
  `[title](/abs/path.md)` (bundle-absolute, recommended) or `[title](./rel.md)`.
  A link asserts a relationship; its *kind* is conveyed by the surrounding
  prose, not by the link.
- **No prescribed folder structure** — directory organization is producer-defined.
- **Order among siblings is NOT specified** — consumers fall back to filesystem
  order or synthesize their own.
- **Version**: a bundle MAY declare `okf_version: "0.1"` in the **root
  `index.md`** frontmatter.

The two gaps that matter to Muninn — **order** and **explicit edges/DAG** — OKF
leaves to the producer. That is exactly what `manifest.json` fills.

---

## 2. Archive shape

```
<bundle>/                      # a directory tree (zip / tarball / git for transport)
  index.md                     # OKF reserved listing — okf_version: "0.1" ONLY (no concept frontmatter)
  manifest.json                # MUNINN EXTENSION — order + edges (see §5)
  <root-slug>.md               # the bundle root, a concept file (type: bundle)
  <root-slug>/                 # the root's children
    <section>.md               #   a section, a concept file (type: section)
    <section>/                 #   that section's children …
      <chapter>.md             #     a chapter concept file (type: record)
      <chapter>/               #     the chapter's leaves …
        text.md                #       type: text
        package.md             #       type: package
```

- **Every node is a concept file `<path>.md`** carrying its OKF frontmatter; its
  children live in the **sibling directory `<path>/`**. OKF is silent on a
  `foo.md` + `foo/` pair, and doesn't forbid it — this is how the hierarchy is
  carried while keeping each concept a single `.md` document (§2).
- `index.md` is a **listing-only** file (no concept frontmatter) emitted in
  **every directory that has children**, for OKF progressive disclosure (§6) —
  `* [title](child.md) - description` per child, matching the GCP reference
  output. The **archive-root** `index.md` additionally carries the one allowed
  frontmatter key, `okf_version: "0.1"`.
- `manifest.json` is a **non-OKF Muninn extension**. A pure-OKF consumer ignores
  it. A Muninn consumer treats it as authoritative for **order, relations, and
  node identity**; the `.md` files are authoritative for **bodies, `type`,
  `title`, `description`, `status`, `tags`** — so a hand-edit to a concept file
  is honored on re-import.

---

## 3. Node → concept-file mapping

OKF v0.1: a concept is **one markdown document**, `index.md` is reserved for a
*listing with no frontmatter*, and **directories carry no metadata**. So:

| Node | Filesystem entry | Children |
|------|------------------|----------|
| **Root** (`type: bundle`) | `<slug>.md` (frontmatter) | sibling `<slug>/` dir |
| **Section** (`type: section`, no `mem_id`) | `<slug>.md` (frontmatter: title/description) | sibling `<slug>/` dir |
| **Chapter / record** (`mem_id` set) | `<slug>.md` (frontmatter + body) | sibling `<slug>/` dir (if it owns leaves) |
| **Leaf** (`text`/`package`/`quotes`) | `<slug>.md` (frontmatter + body) | — |

Crucially, a **section is a real concept file** (`type: section`) — that is how
its title/description get a *legal* OKF home, since OKF gives directories no
metadata mechanism. A directory `<slug>/` carries no *metadata*, but does get a
listing-only `index.md` (no frontmatter) enumerating its children — the OKF
progressive-disclosure convention, matching the GCP reference bundles.

(Earlier drafts used reserved `_self.md`/`_folder.md`, then per-node `index.md`
*with* frontmatter — both non-conformant. This is the corrected, reference-
validated layout: every concept is `<slug>.md`; `index.md` is listing-only.)

A node slug may not be `index`, `log`, or `manifest` (reserved). Minted slugs
are already `[a-z0-9-]`, so this holds.

---

## 4. Concept file format (OKF frontmatter)

```markdown
---
type: record                                  # REQUIRED (OKF). was 'okfType'
title: What Held the Pen
description: Chapter record — the indexing memory for this chapter.
resource: mokf://concept/0a21ab93-…           # any URI for the backing concept
tags: [chapter-record, what-held-the-pen, ai-book]
timestamp: 2026-06-10T18:03:16.717Z           # ISO 8601, the memory's updatedAt
status: published                             # omitted when null
slug: what-held-the-pen                        # Muninn extension (round-trip identity)
nodeKey: ai-book:ch:0a21ab93-…                # extension (stable node id)
---

CHAPTER RECORD — What Held the Pen
… the backing memory's text, verbatim …
```

- `type` is the OKF-required key (Muninn's okf-type: `bundle` | `section` |
  `record` | `text` | `package` | `quotes` | …).
- `title`/`description`/`resource`/`tags`/`timestamp` are OKF-recommended and
  now always emitted for memory-backed concepts.
- `slug` and `nodeKey` are **Muninn extensions** (OKF: "producers may include
  additional keys") — they give the lossless round-trip its node identity.
- **Body** is the backing memory's `text`, verbatim. A structural folder
  (root/section, no `mem_id`) has no body; its `type`/`title`/`description` live
  in its own concept file `<slug>.md`.

### Relationships (OKF links)
`reference` edges (the DAG cross-links) are emitted **both** as OKF markdown
links in the source concept's body/index (`[target-title](/abs/path.md)`, so an
OKF consumer sees the relationship) **and** in `manifest.json` (so a Muninn
consumer recovers the exact edge without prose-parsing).

---

## 5. manifest.json — the Muninn extension

The lossless backbone for what OKF v0.1 doesn't specify (order, explicit edges,
identity). Not part of OKF; safe for any OKF consumer to ignore.

```json
{
  "mokf_version": "0.1",
  "okf_version": "0.1",
  "exportedAt": "2026-06-19T…Z",
  "root": { "slug": "ai-book", "nodeKey": "mig:ai-book:root:ai-book" },
  "nodes": [
    { "nodeKey": "…", "slug": "…", "path": "ai-book/part-4/what-held-the-pen",
      "type": "record", "status": "published", "memId": "0a21ab93-…",
      "file": "ai-book/part-4/what-held-the-pen.md" }
  ],
  "edges": [
    { "parent": "<nodeKey>", "child": "<nodeKey>", "position": 5000, "relation": "contains" },
    { "parent": "<nodeKey>", "child": "<nodeKey>", "position": 5000, "relation": "reference" }
  ]
}
```

- `edges[]` carries **all** edges — `contains` (the authoritative sibling order
  via `position`) and `reference` (the DAG links). This is the part OKF leaves
  to the producer.
- `nodes[]` records each node's filesystem `path`/`file` + `memId` so import can
  relink to (or recreate) the backing memory.

---

## 6. Round-trip contract

1. **Export** (`exportMokf`): bundle → `{ files: Record<path, string>, manifest }`.
   Pure read; OKF concept files + `index.md` + `manifest.json`.
2. **Import** (`importMokf`): files + manifest → recreated nodes, edges, backing
   memories. Idempotent; nodes by `nodeKey`, edges by (parent, child, relation),
   bodies written to `memId`.
3. **Gate** (`mokfRoundTripDiff`): export → import (under a probe owner) →
   render both → assert byte-identical. Mirrors the migration P5 gate.

A MOKF export that does not round-trip byte-identically is, by definition,
invalid.

---

## 7. Conformance summary

| OKF v0.1 | Muninn export |
|---|---|
| `type` (required) | ✅ emitted |
| `title` / `description` / `resource` / `tags` / `timestamp` (recommended) | ✅ emitted on memory-backed concepts |
| reserved `index.md` (listing only, no concept frontmatter) | ✅ archive-root only, carries okf_version |
| reserved `log.md` | ⚪ not emitted (optional) |
| relationships = markdown links in body | ✅ emitted (also mirrored in manifest) |
| order among siblings | ➕ **Muninn extension** (`manifest.json` `position`) — OKF leaves this open |
| explicit edges / DAG | ➕ **Muninn extension** (`manifest.json` `edges`) — OKF expresses relationships only via prose links |
| extra producer keys preserved | ✅ `slug`, `nodeKey` round-trip identity |

**The bet:** emit *real* OKF (any OKF tool reads it), and add exactly one
sidecar — `manifest.json` — for the relational/ordering structure OKF v0.1
doesn't model, so Muninn round-trips losslessly without forking the format.

<!-- mokf-spec-version: 0.4 (validated against GCP reference bundles) -->
