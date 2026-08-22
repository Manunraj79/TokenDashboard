# Prompt Cost Estimator

A static, frontend-only web app that estimates how much a prompt would cost across different LLM models. Paste your prompt, adjust expected response length, and compare costs locally — **no backend, no API keys, no network calls for tokenization**.

> **Disclaimer:** All token counts are heuristic estimates, not real tokenizer output. Pricing data is unofficial/third-party and may be outdated. Use for planning only.

---

## Features

- **Local token estimation** — character + word heuristics, debounced as you type
- **Adjustable output assumptions** — Concise (3×), Typical (8×), Verbose (15×), or manual override
- **Multi-model comparison** — animated bar chart + sortable detail table
- **Cheapest model highlight** — sorted by total cost ascending
- **Editable pricing** — add or update models via `pricing.json` without code changes
- **Fully offline capable** — copy `dist/` anywhere; works without a server
- **Privacy-first** — your prompt never leaves the browser

---

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Hosting | Any static host (Netlify, Vercel, GitHub Pages, local folder) |

---

## Quick start

### Development

```bash
git clone <your-repo-url>
cd TokenDashboard
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview   # optional — serve dist/ at http://localhost:4173
```

Output goes to `dist/`:

```
dist/
├── index.html
├── pricing.json      # editable model rates (HTTP)
├── pricing.js        # same data for file:// offline use
├── Open-app.bat      # Windows launcher
├── VIEWING.txt       # offline / OneDrive notes
└── assets/
    ├── index-*.js
    └── style-*.css
```

---

## How it works

### 1. Token estimation (same for every model)

The app does **not** call any tokenizer API. It uses simple heuristics in `src/lib/tokenizer.ts`:

| Metric | Formula |
|---|---|
| Character estimate | `ceil(character count ÷ 4)` |
| Word estimate | `ceil(word count ÷ 0.75)` |
| **Input tokens** | average of both estimates, rounded up |
| **Output tokens** | `input tokens × verbosity multiplier` |

**Verbosity presets**

| Preset | Multiplier |
|---|---|
| Concise | 3× input |
| Typical (default) | 8× input |
| Verbose | 15× input |

You can override output tokens manually in the UI.

### 2. Cost calculation (per model)

Each model has its own input/output price per million tokens from `pricing.json`:

```
inputCost  = (inputTokens  / 1_000_000) × inputPerMTok
outputCost = (outputTokens / 1_000_000) × outputPerMTok
totalCost  = inputCost + outputCost
```

The same token estimate is applied to all models; only the rates differ. Results are shown to 4 decimal places and sorted cheapest first.

---

## Adding or updating models

Edit `public/pricing.json` (or `dist/pricing.json` after build):

```json
{
  "model": "Model name",
  "inputPerMTok": 3.0,
  "outputPerMTok": 15.0,
  "note": "Optional note shown in the table"
}
```

**Rules**

- `model`, `inputPerMTok`, `outputPerMTok`, and `note` are all required
- Prices are USD per **1,000,000 tokens**
- Values must be non-negative numbers
- Rebuild (`npm run build`) to regenerate `pricing.js` for offline use

**Seed models included:** Claude (Fable, Opus, Sonnet, Haiku) and OpenAI (GPT-5.6 Sol, Luna).

---

## Deployment

### Static host (recommended)

Deploy the `dist/` folder to Netlify, Vercel, GitHub Pages, S3, etc. No server configuration needed.

For GitHub Pages in a subpath, Vite `base: "./"` already uses relative asset URLs.

### Offline / USB / shared folder

1. Run `npm run build`
2. Copy the entire `dist/` folder
3. Open `index.html` in Chrome or Edge, or double-click `Open-app.bat` (Windows)

**On `file://`:** browsers block `fetch()`, so pricing loads from `pricing.js`.  
**On `http(s)`:** pricing loads from `pricing.json`.

### OneDrive / cloud drives

Do **not** open `index.html` from the OneDrive **website** preview — it runs inside Microsoft's viewer and may show console warnings or block scripts.

Instead:

1. Sync the folder locally (**Always keep on this device**)
2. Use **`Open-app.bat`** or **Open with → Chrome/Edge**
3. See `dist/VIEWING.txt` for details

---

## Project structure

```
TokenDashboard/
├── public/
│   ├── pricing.json       # model pricing table (source of truth)
│   ├── pricing.js         # generated for offline file://
│   ├── Open-app.bat
│   └── VIEWING.txt
├── src/
│   ├── App.tsx            # main UI
│   ├── lib/
│   │   ├── tokenizer.ts   # token heuristics
│   │   └── cost.ts        # per-model cost math
│   └── types.ts           # TypeScript interfaces
├── dist/                  # production build output
├── vite.config.ts
└── package.json
```

---

## Limitations

- Not a real tokenizer — actual token counts will differ by model, language, and content type (code vs prose)
- Does not include system prompts, tool calls, cached tokens, or long-context pricing tiers
- Pricing is manually maintained and may not match official provider rates
- Output length is assumed, not measured

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve `dist/` locally over HTTP |

---

## License

Add your preferred license here (e.g. MIT).
