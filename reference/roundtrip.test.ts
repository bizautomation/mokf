/**
 * MOKF reference conformance test. Builds a small bundle exercising the hard
 * cases (folders, a concept that owns leaves, a reference/DAG edge), exports to
 * MOKF, re-imports, and asserts the render is byte-identical — and that the
 * archive is OKF-shaped (concept files, per-dir index.md listings, block tags,
 * `# Related` body links).
 *
 * Run: npx tsx reference/roundtrip.test.ts   (or: node --import tsx ...)
 */

import { exportMokf, importMokf, roundTrip, parseFrontmatter, type Bundle } from "./mokf.js";

let fails = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "\n        " + detail}`);
  if (!cond) fails++;
};

// A book → section → chapter (owns a text leaf) + chapter2; chapter → chapter2 reference.
const bundle: Bundle = {
  rootKey: "n:root",
  nodes: [
    { key: "n:root", slug: "ai-book", type: "bundle" },
    { key: "n:sec",  slug: "part-1",  type: "section" },
    { key: "n:ch",   slug: "what-held-the-pen", type: "record", status: "published", conceptId: "m-rec" },
    { key: "n:text", slug: "text",    type: "text",   conceptId: "m-text" },
    { key: "n:ch2",  slug: "why-it-matters", type: "record", conceptId: "m-ch2" },
  ],
  edges: [
    { parent: "n:root", child: "n:sec",  position: 1000, relation: "contains" },
    { parent: "n:sec",  child: "n:ch",   position: 1000, relation: "contains" },
    { parent: "n:ch",   child: "n:text", position: 1000, relation: "contains" },
    { parent: "n:sec",  child: "n:ch2",  position: 2000, relation: "contains" },
    { parent: "n:ch",   child: "n:ch2",  position: 1000, relation: "reference" },
  ],
  concepts: {
    "m-rec":  { id: "m-rec",  text: "CHAPTER RECORD — What Held the Pen\n\nThe record body.", tags: ["chapter-record", "what-held-the-pen"], timestamp: "2026-06-10T18:03:16.717Z" },
    "m-text": { id: "m-text", text: "Full final text of the chapter.\n\nVerbatim prose." },
    "m-ch2":  { id: "m-ch2",  text: "Why It Matters\n\nSecond chapter body." },
  },
  folderMeta: {
    "n:root": { title: "AI Has No Morality. It Has Yours.", description: "Boy's AI book." },
    "n:sec":  { title: "Part 1: How To Use It", description: "The opener." },
  },
};

const NOW = "2026-06-19T00:00:00.000Z";
const archive = exportMokf(bundle, NOW);
const f = archive.files;

console.log("[archive shape — OKF conformant]");
ok("manifest declares okf_version 0.1", archive.manifest.okf_version === "0.1");
ok("every node is a concept file <slug>.md", !!f["ai-book.md"] && !!f["ai-book/part-1.md"] && !!f["ai-book/part-1/what-held-the-pen.md"]);
ok("leaf lives in the sibling dir", !!f["ai-book/part-1/what-held-the-pen/text.md"]);
ok("per-dir index.md listing exists", !!f["ai-book/index.md"]);
ok("per-dir index.md is listing-only (no frontmatter)", !f["ai-book/index.md"].startsWith("---"));
ok("per-dir index.md links children", /\* \[.+\]\(.+\.md\)/.test(f["ai-book/index.md"]));
ok("root index.md carries okf_version only", f["index.md"].includes('okf_version: "0.1"'));

console.log("\n[OKF frontmatter]");
const ch = parseFrontmatter(f["ai-book/part-1/what-held-the-pen.md"]);
ok("type is the required key", ch.fields.type === "record");
ok("resource is a URI", String(ch.fields.resource || "").includes("://"));
ok("tags is a list", Array.isArray(ch.fields.tags));
ok("tags emitted block-style", /\ntags:\n- /.test(f["ai-book/part-1/what-held-the-pen.md"]));
ok("reference edge → `# Related` body link", /# Related\n- \[.+\]\(\/ai-book\/part-1\/why-it-matters\.md\)/.test(f["ai-book/part-1/what-held-the-pen.md"]));

console.log("\n[round-trip]");
const rt = roundTrip(bundle, NOW);
ok("export → import → render is byte-identical", rt.identical,
  `firstDiffAt=${rt.firstDiffAt}\n--- original ---\n${rt.original}\n--- roundTrip ---\n${rt.roundTrip}`);

console.log("\n[idempotent re-import]");
const re1 = importMokf(archive, NOW);
const re2 = importMokf(exportMokf(re1, NOW), NOW);
ok("re-import yields the same node/edge counts", re2.nodes.length === bundle.nodes.length && re2.edges.length === bundle.edges.length);

console.log(`\n${fails === 0 ? "ALL PASSED" : fails + " FAILURE(S)"}`);
process.exit(fails === 0 ? 0 : 1);
