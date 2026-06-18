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
| [`samples/ai-book.mokf/`](samples/ai-book.mokf/) | A real exported bundle you can browse — concept files, per-directory `index.md` listings, `# Related` links, `manifest.json`. |

## The format in 30 seconds

```
ai-book.mokf/
  index.md                          # OKF listing + okf_version: "0.1"  (no concept frontmatter)
  manifest.json                     # the MOKF extension: order + edges
  ai-book.md                        # a concept file (type: bundle)
  ai-book/
    index.md                        # listing of this dir's children
    part-1.md                       # type: section  (its title lives here)
    part-1/
      what-held-the-pen.md          # type: record + the body + a `# Related` link
      what-held-the-pen/
        text.md                     # type: text
```

- **Every node is a concept file `<slug>.md`** with OKF frontmatter (`type`
  required; `title`/`description`/`resource`/`tags`/`timestamp` recommended).
  Its children live in the **sibling `<slug>/` directory**.
- **`index.md`** is a listing only (no concept frontmatter), in every directory —
  OKF progressive disclosure.
- **Relationships** (cross-links) are real Markdown links in the body, under a
  `# Related` heading — *and* in `manifest.json` (so a MOKF consumer recovers the
  exact edge, and order, without prose-parsing).

See [`spec/SPEC.md`](spec/SPEC.md) for the normative detail.

## Run the conformance gate

```bash
npx tsx reference/roundtrip.test.ts     # asserts byte-identical round-trip + OKF shape
npx tsx reference/gen-sample.ts         # regenerates samples/ai-book.mokf/
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
