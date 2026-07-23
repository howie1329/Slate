import { chmod, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sidecarRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(sidecarRoot, "..");
const entry = resolve(sidecarRoot, "dist/slate-ai-sidecar.cjs");
const targetTriple = execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();

if (!targetTriple) {
  throw new Error("Could not determine the Rust host target triple.");
}

if (targetTriple !== "aarch64-apple-darwin" && targetTriple !== "x86_64-apple-darwin") {
  throw new Error(`Unsupported sidecar packaging target: ${targetTriple}`);
}

const output = resolve(projectRoot, "src-tauri/binaries", `slate-ai-sidecar-${targetTriple}`);
await mkdir(dirname(output), { recursive: true });

execFileSync(resolve(sidecarRoot, "node_modules/.bin/pkg"), [
  entry,
  "--sea",
  "--output",
  output,
], { stdio: "inherit" });

await chmod(output, 0o755);
console.log(`Built ${output}`);
