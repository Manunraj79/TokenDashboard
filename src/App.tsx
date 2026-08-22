import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  Check,
  ChevronRight,
  Coins,
  FileText,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calculateCosts } from "./lib/cost";
import {
  estimateTokens,
  VERBOSITY_MULTIPLIERS,
} from "./lib/tokenizer";
import type {
  ChartMetric,
  Model,
  PricingTable,
  Verbosity,
} from "./types";

declare global {
  interface Window {
    __TOKEN_DASHBOARD_PRICING__?: unknown;
  }
}

const VERBOSITY_OPTIONS: Array<{
  value: Verbosity;
  label: string;
  description: string;
}> = [
  { value: "concise", label: "Concise", description: "3× input" },
  { value: "typical", label: "Typical", description: "8× input" },
  { value: "verbose", label: "Verbose", description: "15× input" },
];

const CHART_OPTIONS: Array<{ value: ChartMetric; label: string }> = [
  { value: "totalCost", label: "Total cost" },
  { value: "inputCost", label: "Input cost" },
  { value: "outputCost", label: "Output cost" },
];

const CHART_LABELS: Record<ChartMetric, string> = {
  totalCost: "Total cost",
  inputCost: "Input cost",
  outputCost: "Output cost",
};

const CHART_COLORS = [
  "#3f7568",
  "#669086",
  "#8ca9a2",
  "#b1c2bd",
  "#d89a80",
  "#d98263",
  "#c65e42",
];

const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
};

const isModel = (value: unknown): value is Model => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.model === "string" &&
    candidate.model.trim().length > 0 &&
    typeof candidate.inputPerMTok === "number" &&
    Number.isFinite(candidate.inputPerMTok) &&
    candidate.inputPerMTok >= 0 &&
    typeof candidate.outputPerMTok === "number" &&
    Number.isFinite(candidate.outputPerMTok) &&
    candidate.outputPerMTok >= 0 &&
    typeof candidate.note === "string"
  );
};

const parsePricingTable = (value: unknown): PricingTable => {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isModel)) {
    throw new Error("Pricing data has an invalid format.");
  }

  return { models: value };
};

/** fetch works on http(s); file:// uses pricing.js (classic script) instead. */
const loadPricingData = async (signal: AbortSignal): Promise<unknown> => {
  const canFetch =
    window.location.protocol === "http:" ||
    window.location.protocol === "https:";

  if (canFetch) {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}pricing.json`, {
        signal,
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  if (window.__TOKEN_DASHBOARD_PRICING__ !== undefined) {
    return window.__TOKEN_DASHBOARD_PRICING__;
  }

  throw new Error(
    "Unable to load pricing data. Open via a local server, or ensure pricing.js is next to index.html.",
  );
};

const formatCost = (cost: number): string => `$${cost.toFixed(4)}`;
const formatNumber = (value: number): string =>
  new Intl.NumberFormat("en-US").format(value);

const getSegmentClasses = (isSelected: boolean): string => {
  const baseClasses =
    "rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-coral";
  if (isSelected) return `${baseClasses} bg-ink text-white shadow-sm`;

  return `${baseClasses} text-stone-500 hover:bg-white hover:text-ink`;
};

const BreakdownItem = ({
  label,
  value,
  detail,
  emphasized = false,
}: {
  label: string;
  value: string;
  detail: string;
  emphasized?: boolean;
}) => (
  <div className="flex items-center justify-between gap-4 border-b border-stone-200 py-3 last:border-0">
    <div>
      <p className="text-sm font-medium text-stone-600">{label}</p>
      <p className="mt-0.5 text-xs text-stone-400">{detail}</p>
    </div>
    <span
      className={`font-mono text-sm font-medium ${
        emphasized ? "text-coral" : "text-ink"
      }`}
    >
      {value}
    </span>
  </div>
);

const EmptyResults = () => (
  <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 px-6 text-center">
    <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm">
      <Calculator className="h-6 w-6 text-coral" aria-hidden="true" />
    </div>
    <h3 className="font-semibold text-ink">Your comparison will appear here</h3>
    <p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">
      Add a prompt to estimate token usage and compare model costs.
    </p>
  </div>
);

const App = () => {
  const [prompt, setPrompt] = useState("");
  const [verbosity, setVerbosity] = useState<Verbosity>("typical");
  const [manualOutputTokens, setManualOutputTokens] = useState<number | null>(
    null,
  );
  const [chartMetric, setChartMetric] = useState<ChartMetric>("totalCost");
  const [pricingTable, setPricingTable] = useState<PricingTable | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [pricingRequest, setPricingRequest] = useState(0);
  const debouncedPrompt = useDebouncedValue(prompt, 300);

  useEffect(() => {
    const abortController = new AbortController();

    const loadPricing = async () => {
      setPricingError(null);

      try {
        const pricingData = await loadPricingData(abortController.signal);
        setPricingTable(parsePricingTable(pricingData));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setPricingTable(null);
        setPricingError(
          error instanceof Error
            ? error.message
            : "Unable to load pricing data.",
        );
      }
    };

    void loadPricing();
    return () => abortController.abort();
  }, [pricingRequest]);

  const estimate = useMemo(
    () =>
      estimateTokens(debouncedPrompt, verbosity, manualOutputTokens),
    [debouncedPrompt, manualOutputTokens, verbosity],
  );

  const costRows = useMemo(
    () =>
      calculateCosts(
        pricingTable?.models ?? [],
        estimate.inputTokens,
        estimate.outputTokens,
      ),
    [estimate.inputTokens, estimate.outputTokens, pricingTable],
  );

  const hasPrompt = debouncedPrompt.length > 0;
  const outputFieldValue =
    manualOutputTokens ?? (hasPrompt ? estimate.outputTokens : "");

  const handlePromptChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setPrompt(event.target.value);
  };

  const handleVerbosityChange = (nextVerbosity: Verbosity) => {
    setVerbosity(nextVerbosity);
    setManualOutputTokens(null);
  };

  const handleOutputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value === "") {
      setManualOutputTokens(null);
      return;
    }

    const nextValue = Number(event.target.value);
    if (!Number.isFinite(nextValue)) return;

    setManualOutputTokens(Math.max(0, Math.floor(nextValue)));
  };

  const handleResetOutput = () => setManualOutputTokens(null);
  const handleRetryPricing = () => setPricingRequest((request) => request + 1);
  const isEmbeddedPreview = window.self !== window.top;

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-ink p-2.5 text-white">
            <Coins className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-coral">
              Local calculator
            </p>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Prompt cost estimator
            </h1>
          </div>
        </div>
        <div
          className="border-t border-amber-200 bg-amber-50"
          role="note"
          aria-label="Estimation disclaimer"
        >
          <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-4 py-3 text-xs leading-5 text-amber-900 sm:px-6 lg:px-8">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <p>
              <strong>Estimates only.</strong> Uses heuristic tokenization, not a
              real tokenizer. Pricing is unofficial/third-party data.
            </p>
          </div>
        </div>
        {isEmbeddedPreview && (
          <div
            className="border-t border-sky-200 bg-sky-50"
            role="status"
            aria-label="Embedded preview notice"
          >
            <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-4 py-3 text-xs leading-5 text-sky-900 sm:px-6 lg:px-8">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                Opened inside a preview frame (for example OneDrive web). For the
                full app, sync the folder locally and run <strong>Open-app.bat</strong>,
                or open <strong>index.html</strong> with Chrome or Edge. Console
                unload warnings usually come from the preview shell, not this app.
              </p>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
          <section className="space-y-5" aria-labelledby="prompt-heading">
            <div className="rounded-2xl border bg-white p-5 shadow-card sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 id="prompt-heading" className="text-lg font-bold">
                    Your prompt
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Calculated locally after a short pause.
                  </p>
                </div>
                <span className="font-mono text-xs text-stone-400">
                  {formatNumber(prompt.length)} chars
                </span>
              </div>

              <label htmlFor="prompt" className="sr-only">
                Prompt text
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={handlePromptChange}
                rows={12}
                placeholder="Paste a prompt, specification, or code-generation request…"
                className="w-full resize-y rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-stone-400 focus:border-coral focus:bg-white focus:ring-4 focus:ring-coral/10"
              />
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-card sm:p-6">
              <div className="mb-4">
                <h2 className="text-base font-bold">Response verbosity</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Sets the expected output relative to estimated input.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
                {VERBOSITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleVerbosityChange(option.value)}
                    aria-pressed={verbosity === option.value}
                    className={getSegmentClasses(verbosity === option.value)}
                  >
                    <span className="block">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] font-medium opacity-70">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="output-tokens"
                    className="text-sm font-semibold text-stone-700"
                  >
                    Output tokens
                  </label>
                  {manualOutputTokens !== null && (
                    <button
                      type="button"
                      onClick={handleResetOutput}
                      className="text-xs font-semibold text-coral underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                    >
                      Use preset
                    </button>
                  )}
                </div>
                <input
                  id="output-tokens"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={outputFieldValue}
                  onChange={handleOutputChange}
                  disabled={!hasPrompt}
                  aria-describedby="output-help"
                  className="mt-2 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 font-mono text-sm outline-none transition focus:border-coral focus:bg-white focus:ring-4 focus:ring-coral/10 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p id="output-help" className="mt-2 text-xs text-stone-400">
                  Edit this number to override the{" "}
                  {VERBOSITY_MULTIPLIERS[verbosity]}× preset.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-card sm:p-6">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-coral" aria-hidden="true" />
                <h2 className="text-base font-bold">Estimation breakdown</h2>
                <span className="ml-auto rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  Estimate
                </span>
              </div>
              <BreakdownItem
                label="Characters"
                value={formatNumber(estimate.characterCount)}
                detail="Raw prompt length"
              />
              <BreakdownItem
                label="Words"
                value={formatNumber(estimate.wordCount)}
                detail="Whitespace-separated"
              />
              <BreakdownItem
                label="Character estimate"
                value={formatNumber(estimate.characterBasedTokens)}
                detail="Characters ÷ 4"
              />
              <BreakdownItem
                label="Word estimate"
                value={formatNumber(estimate.wordBasedTokens)}
                detail="Words ÷ 0.75"
              />
              <BreakdownItem
                label="Chosen input tokens"
                value={formatNumber(estimate.inputTokens)}
                detail="Average of both estimates, rounded up"
                emphasized
              />
              <BreakdownItem
                label="Output tokens"
                value={formatNumber(estimate.outputTokens)}
                detail={
                  manualOutputTokens === null
                    ? `${VERBOSITY_MULTIPLIERS[verbosity]}× input preset`
                    : "Manual override"
                }
                emphasized
              />
            </div>
          </section>

          <section
            className="space-y-5 lg:sticky lg:top-6"
            aria-labelledby="comparison-heading"
          >
            <div className="rounded-2xl border bg-white p-5 shadow-card sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="h-4 w-4 text-coral"
                      aria-hidden="true"
                    />
                    <h2 id="comparison-heading" className="text-lg font-bold">
                      Cost comparison
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    USD per estimated response
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1">
                  {CHART_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setChartMetric(option.value)}
                      aria-pressed={chartMetric === option.value}
                      className={getSegmentClasses(
                        chartMetric === option.value,
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                {pricingError && (
                  <div
                    className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
                    role="alert"
                  >
                    <AlertTriangle
                      className="h-7 w-7 text-red-500"
                      aria-hidden="true"
                    />
                    <p className="mt-3 font-semibold text-red-900">
                      Pricing could not be loaded
                    </p>
                    <p className="mt-1 text-sm text-red-700">{pricingError}</p>
                    <button
                      type="button"
                      onClick={handleRetryPricing}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-900 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Retry
                    </button>
                  </div>
                )}

                {!pricingError && !pricingTable && (
                  <div
                    className="flex min-h-80 items-center justify-center text-sm text-stone-500"
                    role="status"
                  >
                    <RefreshCw
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Loading local pricing…
                  </div>
                )}

                {!pricingError && pricingTable && !hasPrompt && (
                  <EmptyResults />
                )}

                {!pricingError && pricingTable && hasPrompt && (
                  <div
                    className="h-[360px] w-full"
                    role="img"
                    aria-label={`${CHART_LABELS[chartMetric]} comparison by model`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        key={`${chartMetric}-${estimate.inputTokens}-${estimate.outputTokens}`}
                        data={costRows}
                        layout="vertical"
                        margin={{ top: 4, right: 18, bottom: 4, left: 6 }}
                      >
                        <CartesianGrid
                          stroke="#e7e5e4"
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tickFormatter={(value: number) =>
                            `$${Number(value).toFixed(4)}`
                          }
                          tick={{ fill: "#78716c", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="model"
                          width={82}
                          tick={{ fill: "#44403c", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "#f5f5f4" }}
                          formatter={(value) => [
                            formatCost(Number(value)),
                            CHART_LABELS[chartMetric],
                          ]}
                          contentStyle={{
                            borderRadius: 12,
                            borderColor: "#e7e5e4",
                            boxShadow: "0 8px 24px rgba(23,32,42,.12)",
                          }}
                        />
                        <Bar
                          dataKey={chartMetric}
                          radius={[0, 7, 7, 0]}
                          animationBegin={100}
                          animationDuration={900}
                          animationEasing="ease-out"
                          minPointSize={2}
                        >
                          {costRows.map((row, index) => (
                            <Cell
                              key={row.model}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {!pricingError && pricingTable && hasPrompt && (
              <div className="overflow-hidden rounded-2xl border bg-white shadow-card">
                <div className="border-b px-5 py-4 sm:px-6">
                  <h2 className="font-bold">Model details</h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Sorted from lowest to highest total cost.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-semibold">
                          Model
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Input cost
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Output cost
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Total
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Note
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {costRows.map((row, index) => (
                        <tr
                          key={row.model}
                          className={
                            index === 0
                              ? "bg-emerald-50/70"
                              : "transition hover:bg-stone-50"
                          }
                        >
                          <th
                            scope="row"
                            className="whitespace-nowrap px-5 py-4 font-semibold text-ink"
                          >
                            <span className="flex items-center gap-2">
                              {row.model}
                              {index === 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                                  <Check
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                  />
                                  Cheapest
                                </span>
                              )}
                            </span>
                          </th>
                          <td className="px-4 py-4 font-mono text-xs text-stone-600">
                            {formatCost(row.inputCost)}
                          </td>
                          <td className="px-4 py-4 font-mono text-xs text-stone-600">
                            {formatCost(row.outputCost)}
                          </td>
                          <td className="px-4 py-4 font-mono text-xs font-semibold text-ink">
                            {formatCost(row.totalCost)}
                          </td>
                          <td className="max-w-52 px-4 py-4 text-xs leading-5 text-stone-500">
                            {row.note || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 border-t bg-stone-50 px-5 py-3 text-xs text-stone-500 sm:px-6">
                  <ChevronRight
                    className="h-3.5 w-3.5 text-coral"
                    aria-hidden="true"
                  />
                  Input: {formatNumber(estimate.inputTokens)} tokens · Output:{" "}
                  {formatNumber(estimate.outputTokens)} tokens
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-stone-200 px-4 py-6 text-center text-xs text-stone-400">
        Runs entirely in your browser. Your prompt is never sent anywhere.
      </footer>
    </div>
  );
};

export default App;
