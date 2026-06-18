/**
 * MOKF reference conformance test. Uses the example bundle (Asimov's Laws of
 * Robotics — see sample.ts), exports to MOKF, re-imports, and asserts the render
 * is byte-identical — plus that the archive is OKF-shaped (concept files,
 * per-dir index.md listings, block tags, `# Related` body links, preserved order).
 *
 * Run: npx tsx reference/roundtrip.test.ts
 */

import { exportMokf, importMokf, roundTrip, parseFrontmatter } from "./mokf.js";
import { sampleBundle as bundle } from "./sample.js";

let fails = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "\n        " + detail}`);
  if (!cond) fails++;
};

const NOW = "2026-06-19T00:00:00.000Z";
const archive = exportMokf(bundle, NOW);
const f = archive.files;

console.log("[archive shape — OKF conformant]");
ok("manifest declares okf_version 0.1", archive.manifest.okf_version === "0.1");
ok("every node is a concept file <slug>.md",
  !!f["three-laws.md"] && !!f["three-laws/laws.md"] && !!f["three-laws/laws/zeroth-law.md"]);
ok("a concept that owns children has a sibling dir + leaf",
  !!f["three-laws/laws/first-law.md"] && !!f["three-laws/laws/first-law/examples.md"]);
ok("per-dir index.md listing exists", !!f["three-laws/laws/index.md"]);
ok("per-dir index.md is listing-only (no frontmatter)", !f["three-laws/laws/index.md"].startsWith("---"));
ok("root index.md carries okf_version only", f["index.md"].includes('okf_version: "0.1"'));

console.log("\n[order — the manifest's reason to exist]");
const lawsIndex = f["three-laws/laws/index.md"];
const order = ["zeroth-law", "first-law", "second-law", "third-law"]
  .map(s => lawsIndex.indexOf(s));
ok("listing preserves precedence order (Zeroth→First→Second→Third)",
  order.every((v, i) => i === 0 || v > order[i - 1]),
  `positions: ${order.join(", ")}`);

console.log("\n[OKF frontmatter]");
const law = parseFrontmatter(f["three-laws/laws/zeroth-law.md"]);
ok("type is the required key", law.fields.type === "law");
ok("resource is a URI", String(law.fields.resource || "").includes("://"));
ok("tags is a list", Array.isArray(law.fields.tags));
ok("tags emitted block-style", /\ntags:\n- /.test(f["three-laws/laws/zeroth-law.md"]));

console.log("\n[relationships — the DAG edge as an OKF body link]");
ok("Zeroth Law links to First Law (`# Related`)",
  /# Related\n- \[First Law\]\(\/three-laws\/laws\/first-law\.md\)/.test(f["three-laws/laws/zeroth-law.md"]));

console.log("\n[round-trip]");
const rt = roundTrip(bundle, NOW);
ok("export → import → render is byte-identical", rt.identical,
  `firstDiffAt=${rt.firstDiffAt}\n--- original ---\n${rt.original}\n--- roundTrip ---\n${rt.roundTrip}`);

console.log("\n[idempotent re-import]");
const re1 = importMokf(archive, NOW);
const re2 = importMokf(exportMokf(re1, NOW), NOW);
ok("re-import yields the same node/edge counts",
  re2.nodes.length === bundle.nodes.length && re2.edges.length === bundle.edges.length);

console.log(`\n${fails === 0 ? "ALL PASSED" : fails + " FAILURE(S)"}`);
process.exit(fails === 0 ? 0 : 1);
