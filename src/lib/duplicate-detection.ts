// Deterministic keyword-overlap duplicate detection -- no AI call. Runs
// against a civilian's own complaints from the last 24 hours, comparing
// significant words shared between the new and existing title+description,
// with a same-location match as a secondary (lower-bar) signal.

const STOPWORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "been",
  "were",
  "they",
  "them",
  "their",
  "then",
  "than",
  "when",
  "where",
  "which",
  "while",
  "about",
  "around",
  "near",
  "into",
  "onto",
  "over",
  "under",
  "after",
  "before",
  "again",
  "also",
  "some",
  "such",
  "very",
  "just",
  "only",
  "even",
  "back",
  "there",
  "here",
  "what",
  "would",
  "could",
  "should",
  "will",
  "shall",
  "does",
  "did",
  "doing",
  "being",
]);

export const DUPLICATE_KEYWORD_OVERLAP_THRESHOLD = 0.3;
const DUPLICATE_LOCATION_MATCH_THRESHOLD = 0.15;

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export type DuplicateCandidate = {
  id: string;
  title: string;
  description: string;
  location: string;
  created_at: string;
};

export function findLikelyDuplicate(
  candidates: DuplicateCandidate[],
  newTitle: string,
  newDescription: string,
  newLocation: string
): DuplicateCandidate | null {
  const newWords = significantWords(`${newTitle} ${newDescription}`);
  const newLocationNormalized = newLocation.trim().toLowerCase();

  let best: { candidate: DuplicateCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    const candidateWords = significantWords(`${candidate.title} ${candidate.description}`);
    const overlap = jaccardSimilarity(newWords, candidateWords);

    const sameLocation =
      newLocationNormalized.length > 0 &&
      candidate.location.trim().toLowerCase() === newLocationNormalized;

    const isMatch =
      overlap >= DUPLICATE_KEYWORD_OVERLAP_THRESHOLD ||
      (sameLocation && overlap >= DUPLICATE_LOCATION_MATCH_THRESHOLD);

    if (isMatch && (!best || overlap > best.score)) {
      best = { candidate, score: overlap };
    }
  }

  return best?.candidate ?? null;
}
