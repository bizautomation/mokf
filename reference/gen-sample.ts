/** Writes the example bundle from roundtrip.test.ts to samples/ai-book/ as a real
 *  MOKF archive on disk, so adopters can browse actual conformant output.
 *  Run: npx tsx reference/gen-sample.ts */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportMokf, type Bundle } from "./mokf.js";

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
    "n:root": { title: "AI Has No Morality. It Has Yours.", description: "An example bundle." },
    "n:sec":  { title: "Part 1: How To Use It", description: "The opener." },
  },
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "samples", "ai-book.mokf");
const { files } = exportMokf(bundle, "2026-06-19T00:00:00.000Z");
for (const [path, content] of Object.entries(files)) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}
console.log(`Wrote ${Object.keys(files).length} files to samples/ai-book.mokf/`);
