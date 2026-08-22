import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var PRICING_GLOBAL = "__TOKEN_DASHBOARD_PRICING__";
var syncPricingJs = function (outDir) {
    var root = process.cwd();
    var pricingJsonPath = path.join(root, "public", "pricing.json");
    var raw = fs.readFileSync(pricingJsonPath, "utf8").trim();
    var js = "/* Generated from pricing.json \u2014 edit pricing.json then rebuild, or edit this array for offline/file:// use. */\nwindow.".concat(PRICING_GLOBAL, " = ").concat(raw, ";\n");
    fs.writeFileSync(path.join(root, "public", "pricing.js"), js);
    if (outDir) {
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, "pricing.js"), js);
    }
};
var pricingBridge = function () {
    var pricingJsonPath = path.resolve("public/pricing.json");
    return {
        name: "pricing-bridge",
        buildStart: function () {
            syncPricingJs();
        },
        configureServer: function (server) {
            syncPricingJs();
            server.watcher.add(pricingJsonPath);
            server.watcher.on("change", function (file) {
                if (path.resolve(file) === pricingJsonPath) {
                    syncPricingJs();
                }
            });
        },
        writeBundle: function (outputOptions) {
            var _a;
            var outDir = (_a = outputOptions.dir) !== null && _a !== void 0 ? _a : path.resolve("dist");
            syncPricingJs(outDir);
        },
        transformIndexHtml: function (html) {
            if (html.includes("pricing.js"))
                return html;
            return html.replace(/(<head[^>]*>)/i, "$1\n    <script src=\"./pricing.js\"></script>");
        },
    };
};
/** Classic scripts load under file://; ES modules do not (Chrome CORS / null origin). */
var fileProtocolCompat = function () { return ({
    name: "file-protocol-compat",
    enforce: "post",
    transformIndexHtml: {
        order: "post",
        handler: function (html, context) {
            if (context.server)
                return html;
            return html
                .replace(/\s+crossorigin(?:="[^"]*")?/g, "")
                .replace(/\stype="module"/g, " defer")
                .replace(/(<meta name="viewport"[^>]*>)/i, "$1\n    <meta http-equiv=\"Permissions-Policy\" content=\"unload=*\" />");
        },
    },
}); };
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
