import * as esbuild from "esbuild";
import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const watch = process.argv.includes("--watch");
const outdir = "dist";

// ---- Clean ----
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await mkdir(path.join(outdir, "icons"), { recursive: true });

// ---- Rasterize logo.svg → PNG ikonlar (arı-inek kafası) ----
const svg = await readFile("src/logo.svg");
for (const size of [16, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  await writeFile(path.join(outdir, "icons", `icon${size}.png`), png);
}

// ---- Copy static files ----
for (const f of ["manifest.json", "sidepanel.html", "sidepanel.css"]) {
  await cp(path.join("src", f), path.join(outdir, f));
}

// ---- Bundle JS ----
const buildOpts = {
  entryPoints: ["src/background.js", "src/sidepanel.js"],
  bundle: true,
  format: "esm",
  target: "chrome116",
  outdir,
  logLevel: "info",
  define: { "process.env.NODE_ENV": '"production"' },
};

if (watch) {
  const ctx = await esbuild.context(buildOpts);
  await ctx.watch();
  console.log("👀 watching... (dist/ güncelleniyor)");
} else {
  await esbuild.build(buildOpts);
  console.log("✅ build tamam → dist/ klasörünü Chrome'a yükle");
}
