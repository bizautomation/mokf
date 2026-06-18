/** Writes the example bundle (Asimov's Laws of Robotics — see sample.ts) to
 *  samples/three-laws.mokf/ as a real MOKF archive on disk, so adopters can
 *  browse actual conformant output.
 *  Run: npx tsx reference/gen-sample.ts */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportMokf } from "./mokf.js";
import { sampleBundle } from "./sample.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "samples", "three-laws.mokf");
rmSync(root, { recursive: true, force: true });
const { files } = exportMokf(sampleBundle, "2026-06-19T00:00:00.000Z");
for (const [path, content] of Object.entries(files)) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}
console.log(`Wrote ${Object.keys(files).length} files to samples/three-laws.mokf/`);
