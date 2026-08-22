import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const PRICING_GLOBAL = "__TOKEN_DASHBOARD_PRICING__";

const syncPricingJs = (outDir?: string): void => {
  const root = process.cwd();
  const pricingJsonPath = path.join(root, "public", "pricing.json");
  const raw = fs.readFileSync(pricingJsonPath, "utf8").trim();
  const js = `/* Generated from pricing.json — edit pricing.json then rebuild, or edit this array for offline/file:// use. */\nwindow.${PRICING_GLOBAL} = ${raw};\n`;

  fs.writeFileSync(path.join(root, "public", "pricing.js"), js);
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "pricing.js"), js);
  }
};

const pricingBridge = (): Plugin => {
  const pricingJsonPath = path.resolve("public/pricing.json");

  return {
    name: "pricing-bridge",
    buildStart() {
      syncPricingJs();
    },
    configureServer(server) {
      syncPricingJs();
      server.watcher.add(pricingJsonPath);
      server.watcher.on("change", (file) => {
        if (path.resolve(file) === pricingJsonPath) {
          syncPricingJs();
        }
      });
    },
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir ?? path.resolve("dist");
      syncPricingJs(outDir);
    },
    transformIndexHtml(html) {
      if (html.includes("pricing.js")) return html;

      return html.replace(
        /(<head[^>]*>)/i,
        `$1\n    <script src="./pricing.js"></script>`,
      );
    },
  };
};

/** Classic scripts load under file://; ES modules do not (Chrome CORS / null origin). */
const fileProtocolCompat = (): Plugin => ({
  name: "file-protocol-compat",
  enforce: "post",
  transformIndexHtml: {
    order: "post",
    handler(html, context) {
      if (context.server) return html;

      return html
        .replace(/\s+crossorigin(?:="[^"]*")?/g, "")
        .replace(/\stype="module"/g, " defer")
        .replace(
          /(<meta name="viewport"[^>]*>)/i,
          `$1\n    <meta http-equiv="Permissions-Policy" content="unload=*" />`,
        );
    },
  },
});

export default defineConfig({
  plugins: [react(), pricingBridge(), fileProtocolCompat()],
  base: "./",
  build: {
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        format: "iife",
        name: "TokenDashboardApp",
        inlineDynamicImports: true,
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
