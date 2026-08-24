import { cp, rm } from "node:fs/promises";
import { join } from "node:path";

const outdir = "./docs";

// Clean output directory
await rm(outdir, { recursive: true, force: true });

// 1. Build frontend entrypoint (index.html)
const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir,
  minify: true,
  naming: "[dir]/[name].[ext]",
});

if (!result.success) {
  console.error("Build failed:", result.logs);
  process.exit(1);
}

// 2. Copy static assets / folders
try {
  // Copy the levels folder
  await cp("./level", join(outdir, "level"), { recursive: true });

  // Copy CSS folder if it exists and wasn't imported directly into index.html
  await cp("./css", join(outdir, "css"), { recursive: true });

  console.log(`Build completed successfully into ${outdir}`);
} catch (error) {
  console.error("Failed to copy static directories:", error);
  process.exit(1);
}