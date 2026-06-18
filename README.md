# MOKF — a round-trippable profile of OKF

**MOKF** ("Muninn OKF") is a small, lossless **profile of the [Open Knowledge
Format (OKF v0.1)](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)**
published by Google Cloud. It is **not a new format** — a MOKF archive *is* a
valid OKF bundle (plain Markdown files with YAML frontmatter), plus one small
sidecar that makes it **round-trip without loss**.

OKF v0.1 deliberately leaves two things to the producer: **sibling order** and
**explicit relational edges** (a DAG). MOKF adds exactly one file —
`manifest.json` — to carry them. Everything else is standard OKF.

```
A generic OKF consumer (git, a static server, an agent) reads a MOKF archive as
ordinary OKF: it gets every concept's content, frontmatter, and links.

A MOKF-aware consumer also reads manifest.json and recovers exact order + the
full node/edge graph — so a bundle exported to MOKF and re-imported is identical.
```

## Why

A knowledge structure (a book, a catalog, a queue) often has **order** and
**cross-links** that pure-OKF's flat-folder model can't express losslessly. You
could invent a new format — but then no OKF tool reads it. MOKF's bet: **emit
real OKF, add one sidecar**, and get lossless round-trip *and* ecosystem
compatibility.

## What's here

| Path | What |
|------|------|
| [`spec/SPEC.md`](spec/SPEC.md) | The MOKF profile spec: archive shape, frontmatter, the `manifest.json` extension, conformance. |
| [`reference/mokf.ts`](reference/mokf.ts) | A standalone, **zero-dependency** reference implementation: `exportMokf`, `importMokf`, `roundTrip`. |
| [`reference/roundtrip.test.ts`](reference/roundtrip.test.ts) | The conformance gate: export → import → render must be byte-identical. |
| [`samples/three-laws.mokf/`](samples/three-laws.mokf/) | A browsable example bundle — Asimov's Laws of Robotics — showing concept files, per-directory `index.md` listings, preserved **order**, a `# Related` cross-link, and `manifest.json`. |

## The format in 30 seconds

A bundle of Asimov's Laws of Robotics — an **ordered** set with one **cross-link**
(the Zeroth Law supersedes the First): the two things MOKF adds to OKF.

```
three-laws.mokf/
  index.md                          # OKF listing + okf_version: "0.1"  (no concept frontmatter)
  manifest.json                     # the MOKF extension: order + edges
  three-laws.md                     # a concept file (type: bundle)
  three-laws/
    index.md                        # listing of this dir's children
    laws.md                         # type: section  (its title lives here)
    laws/
      index.md                      # Zeroth → First → Second → Third  (ORDER, not alphabetical)
      zeroth-law.md                 # type: law + body + a `# Related` link → first-law.md
      first-law.md
      first-law/
        examples.md                 # a concept can own children
      second-law.md
      third-law.md
```

- **Every node is a concept file `<slug>.md`** with OKF frontmatter (`type`
  required; `title`/`description`/`resource`/`tags`/`timestamp` recommended).
  Its children live in the **sibling `<slug>/` directory**.
- **`index.md`** is a listing only (no concept frontmatter), in every directory —
  OKF progressive disclosure. Its order comes from the manifest (the laws are
  numbered, not alphabetical).
- **Relationships** (cross-links) are real Markdown links in the body, under a
  `# Related` heading — *and* in `manifest.json` (so a MOKF consumer recovers the
  exact edge, and order, without prose-parsing).

See [`spec/SPEC.md`](spec/SPEC.md) for the normative detail.

## Producing MOKF

The reference implementation operates on a plain in-memory model — `Node` +
`Edge` + `Concept` — so any system with that shape can emit MOKF in a few lines:

```ts
import { exportMokf } from "./reference/mokf.js";

const archive = exportMokf({
  rootKey: "root",
  nodes: [
    { key: "root", slug: "my-bundle", type: "bundle" },
    { key: "a",    slug: "intro", type: "note", conceptId: "c1" },
  ],
  edges: [{ parent: "root", child: "a", position: 1000, relation: "contains" }],
  concepts: { c1: { id: "c1", text: "Intro\n\nThe first note.", tags: ["demo"] } },
  folderMeta: { root: { title: "My Bundle", description: "An example." } },
}, new Date().toISOString());

// archive.files: { "<path>": "<contents>" } — write to disk, or zip into a .mokf
// archive.manifest: the order + edge backbone
```

`importMokf(archive, now)` reverses it; `roundTrip(bundle)` proves the two are
byte-identical. See [`reference/sample.ts`](reference/sample.ts) for the full
example bundle.

## Run the conformance gate

```bash
npx tsx reference/roundtrip.test.ts     # asserts byte-identical round-trip + OKF shape
npx tsx reference/gen-sample.ts         # regenerates samples/three-laws.mokf/
```

The reference implementation has **no dependencies** — it operates on a plain
in-memory model (`Node` + `Edge` + `Concept`), so any system with that shape can
produce/consume MOKF.

## Relationship to OKF

MOKF tracks OKF v0.1. It conforms to OKF's normative rules (required `type`
frontmatter; reserved `index.md`/`log.md`; relationships as body links; no
metadata on directories) and matches the layout of Google Cloud's published
reference bundles. The only addition is `manifest.json`, which OKF consumers
ignore. If OKF gains native order/edge support, MOKF's sidecar becomes redundant
by design.

## License

- The **spec** (`spec/`) is licensed under [CC BY 4.0](LICENSE-spec).
- The **reference code** (`reference/`) is licensed under [Apache-2.0](LICENSE-code).

---

*MOKF is maintained alongside [Muninn](https://muninn.bizat.co), the reference
producer. Contributions and OKF-alignment issues welcome.*
