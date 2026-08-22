export interface Model {
  model: string;
  inputPerMTok: number;
  outputPerMTok: number;
  note: string;
}

export interface PricingTable {
  models: Model[];
}

export interface Estimate {
  characterCount: number;
  wordCount: number;
  characterBasedTokens: number;
  wordBasedTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export interface CostRow extends Model {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export type Verbosity = "concise" | "typical" | "verbose";
export type ChartMetric = "totalCost" | "inputCost" | "outputCost";
