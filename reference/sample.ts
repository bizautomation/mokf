/** The example bundle used by both the conformance test and the sample
 *  generator. Models Asimov's Laws of Robotics — a well-known structure that
 *  shows what MOKF adds to OKF: meaningful ORDER (laws are numbered) and an
 *  explicit DAG EDGE (the Zeroth Law supersedes the First). Summaries are
 *  original paraphrase, not Asimov's prose. */
import type { Bundle } from "./mokf.js";

export const sampleBundle: Bundle = {
  rootKey: "n:root",
  nodes: [
    { key: "n:root",  slug: "three-laws", type: "bundle" },
    { key: "n:laws",  slug: "laws",       type: "section" },
    { key: "n:l0",    slug: "zeroth-law", type: "law", conceptId: "c:l0" },
    { key: "n:l1",    slug: "first-law",  type: "law", conceptId: "c:l1" },
    { key: "n:l2",    slug: "second-law", type: "law", conceptId: "c:l2" },
    { key: "n:l3",    slug: "third-law",  type: "law", conceptId: "c:l3" },
    { key: "n:l1ex",  slug: "examples",   type: "note", conceptId: "c:l1ex" },
  ],
  edges: [
    { parent: "n:root", child: "n:laws", position: 1000, relation: "contains" },
    // ORDER: Zeroth, First, Second, Third — not alphabetical/filesystem order.
    { parent: "n:laws", child: "n:l0", position: 1000, relation: "contains" },
    { parent: "n:laws", child: "n:l1", position: 2000, relation: "contains" },
    { parent: "n:laws", child: "n:l2", position: 3000, relation: "contains" },
    { parent: "n:laws", child: "n:l3", position: 4000, relation: "contains" },
    { parent: "n:l1",   child: "n:l1ex", position: 1000, relation: "contains" },
    // DAG EDGE: the Zeroth Law supersedes the First (a cross-link, not a child).
    { parent: "n:l0",   child: "n:l1",  position: 1000, relation: "reference" },
  ],
  concepts: {
    "c:l0": { id: "c:l0", title: "Zeroth Law",
      text: "Zeroth Law\n\nA robot may not harm humanity, or, by inaction, allow humanity to come to harm. Introduced later as a higher principle that takes precedence over the First Law.",
      tags: ["asimov", "robotics", "ethics"], timestamp: "1985-01-01T00:00:00Z",
      resource: "https://en.wikipedia.org/wiki/Three_Laws_of_Robotics#Zeroth_Law_added" },
    "c:l1": { id: "c:l1", title: "First Law",
      text: "First Law\n\nA robot may not injure a human being or, through inaction, allow a human being to come to harm.",
      tags: ["asimov", "robotics", "ethics"], timestamp: "1942-01-01T00:00:00Z",
      resource: "https://en.wikipedia.org/wiki/Three_Laws_of_Robotics" },
    "c:l2": { id: "c:l2", title: "Second Law",
      text: "Second Law\n\nA robot must obey the orders given it by human beings, except where such orders would conflict with the First Law.",
      tags: ["asimov", "robotics"], timestamp: "1942-01-01T00:00:00Z",
      resource: "https://en.wikipedia.org/wiki/Three_Laws_of_Robotics" },
    "c:l3": { id: "c:l3", title: "Third Law",
      text: "Third Law\n\nA robot must protect its own existence as long as such protection does not conflict with the First or Second Law.",
      tags: ["asimov", "robotics"], timestamp: "1942-01-01T00:00:00Z",
      resource: "https://en.wikipedia.org/wiki/Three_Laws_of_Robotics" },
    "c:l1ex": { id: "c:l1ex", title: "First Law — examples",
      text: "First Law — examples\n\n- A robot must pull a person off a track before an oncoming train (acting to prevent harm).\n- A robot may not stand by while a human drowns (inaction that allows harm).",
      tags: ["asimov", "examples"] },
  },
  folderMeta: {
    "n:root": { title: "Asimov's Laws of Robotics", description: "A small example bundle: the Laws of Robotics, an ordered set with one cross-reference (the Zeroth Law supersedes the First). Summaries are original paraphrase." },
    "n:laws": { title: "The Laws", description: "The laws, in precedence order." },
  },
};
