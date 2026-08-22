import type { Estimate, Verbosity } from "../types";

export const VERBOSITY_MULTIPLIERS: Record<Verbosity, number> = {
  concise: 3,
  typical: 8,
  verbose: 15,
};

const countWords = (text: string): number => {
  const trimmedText = text.trim();
  if (!trimmedText) return 0;

  return trimmedText.split(/\s+/u).length;
};

export const estimateTokens = (
  text: string,
  verbosity: Verbosity,
  manualOutputTokens: number | null = null,
): Estimate => {
  if (!text) {
    return {
      characterCount: 0,
      wordCount: 0,
      characterBasedTokens: 0,
      wordBasedTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  const characterCount = text.length;
  const wordCount = countWords(text);
  const characterBasedTokens = Math.ceil(characterCount / 4);
  const wordBasedTokens = Math.ceil(wordCount / 0.75);
  const inputTokens = Math.ceil(
    (characterBasedTokens + wordBasedTokens) / 2,
  );
  const estimatedOutputTokens = Math.ceil(
    inputTokens * VERBOSITY_MULTIPLIERS[verbosity],
  );
  const outputTokens =
    manualOutputTokens === null
      ? estimatedOutputTokens
      : Math.max(0, Math.floor(manualOutputTokens));

  return {
    characterCount,
    wordCount,
    characterBasedTokens,
    wordBasedTokens,
    inputTokens,
    outputTokens,
  };
};
