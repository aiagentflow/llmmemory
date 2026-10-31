import type { Memory } from "./store.js";

const STOPWORDS = new Set(
  (
    "a an and are as at be but by can do does for from has have how i if in is it its me my no not of on or our " +
    "so that the their them then there these they this to was we were what when where which who why will with " +
    "you your use used using should would could please about into just also any all " +
    "go get got add make new thing anything else something"
  ).split(" "),
);

/**
 * Words developers use for the same thing, each group folded into its first
 * word after stemming, so "shipping" finds a memory that says "deploy".
 * Kept short: a wrong synonym recalls memories nobody asked for.
 */
const SYNONYMS: Record<string, string> = Object.fromEntries(
  [
    ["deploy", "deployment", "ship", "shipp"],
    ["database", "db", "dbs"],
    ["prod", "production"],
    ["env", "environment"],
    ["test", "spec"],
    ["doc", "documentation"],
    ["dep", "dependency", "dependencie"],
    ["k8s", "kubernete"],
    ["js", "javascript"],
    ["ts", "typescript"],
    ["repo", "repository", "repositorie"],
    ["config", "configuration"],
    ["auth", "authentication"],
  ].flatMap(([canonical, ...others]) => others.map((word) => [word, canonical])),
);

/** Lowercase terms with stopwords dropped, simple plurals and endings folded, and synonyms merged. */
export function terms(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem)
    .map((w) => SYNONYMS[w] ?? w);
}

function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Each field of a memory and how much a match in it counts. */
function fields(memory: Memory): [string[], number][] {
  return [
    [terms(memory.name.replace(/-/g, " ")), 3],
    [terms(memory.tags.join(" ")), 3],
    [terms(memory.description), 2],
    [terms(memory.body), 1],
  ];
}

export interface Hit {
  memory: Memory;
  score: number;
  /** How many distinct query terms the memory contains. */
  matched: number;
  /** Whether a term matched the name, tags or description rather than only the body. */
  strong: boolean;
}

/** Share of words two texts have in common before a new memory counts as a near-copy. */
const SIMILAR = 0.5;

/**
 * The memory a new fact most nearly repeats, if any: most of the words in
 * the two, taken together, appear in both. Catches a fact restated in other
 * order or with a word changed, which is what agents tend to save twice.
 */
export function similar(memories: Memory[], fact: string): Memory | undefined {
  const words = new Set(terms(fact));
  let best: { memory: Memory; share: number } | undefined;
  for (const memory of memories) {
    const theirs = new Set(terms(`${memory.description} ${memory.body}`));
    const shared = [...words].filter((w) => theirs.has(w)).length;
    const share = shared / new Set([...words, ...theirs]).size;
    if (shared >= 2 && share >= SIMILAR && share > (best?.share ?? 0)) best = { memory, share };
  }
  return best?.memory;
}

/**
 * Ranks memories against a query, BM25 style: a term that few memories share
 * counts for more, and repeating a term has diminishing returns. A match in
 * the name or tags outweighs one in the body. No model, so results are the
 * same on every machine and nothing leaves it.
 */
export function search(memories: Memory[], query: string, limit = 5): Hit[] {
  const wanted = [...new Set(terms(query))];
  if (wanted.length === 0 || memories.length === 0) return [];

  const docs = memories.map((memory) => ({ memory, fields: fields(memory) }));
  const df = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set(doc.fields.flatMap(([words]) => words));
    for (const term of wanted) if (seen.has(term)) df.set(term, (df.get(term) ?? 0) + 1);
  }

  const n = docs.length;
  const hits: Hit[] = [];
  for (const doc of docs) {
    let score = 0;
    let matched = 0;
    let strong = false;
    for (const term of wanted) {
      const count = df.get(term) ?? 0;
      if (count === 0) continue;
      const idf = Math.log(1 + (n - count + 0.5) / (count + 0.5));
      let tf = 0;
      for (const [words, weight] of doc.fields) tf += weight * words.filter((w) => w === term).length;
      if (tf === 0) continue;
      score += (idf * tf * 2.2) / (tf + 1.2);
      matched += 1;
      strong ||= doc.fields.slice(0, 3).some(([words]) => words.includes(term));
    }
    if (score > 0) hits.push({ memory: doc.memory, score, matched, strong });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
