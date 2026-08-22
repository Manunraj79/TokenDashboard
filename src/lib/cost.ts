import type { CostRow, Model } from "../types";

const TOKENS_PER_MILLION = 1_000_000;

export const calculateCosts = (
  models: Model[],
  inputTokens: number,
  outputTokens: number,
): CostRow[] =>
  models
    .map((model) => {
      const inputCost =
        (inputTokens / TOKENS_PER_MILLION) * model.inputPerMTok;
      const outputCost =
        (outputTokens / TOKENS_PER_MILLION) * model.outputPerMTok;

      return {
        ...model,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
      };
    })
    .sort((firstModel, secondModel) => firstModel.totalCost - secondModel.totalCost);
