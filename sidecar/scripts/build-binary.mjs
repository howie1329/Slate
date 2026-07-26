import { chmod, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sidecarRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(sidecarRoot, "..");
const entry = resolve(sidecarRoot, "dist/slate-ai-sidecar.cjs");
const targetTriple = execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();
const supportedTargetTriple = "aarch64-apple-darwin";
const minimumMacOSVersion = "13.5";

if (!targetTriple) {
  throw new Error("Could not determine the Rust host target triple.");
}

if (targetTriple !== supportedTargetTriple) {
  throw new Error(
    `Slate releases support ${supportedTargetTriple}; cannot package the sidecar for ${targetTriple}.`,
  );
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

const architectures = execFileSync("lipo", ["-archs", output], { encoding: "utf8" }).trim();
if (architectures !== "arm64") {
  throw new Error(`Expected an arm64 sidecar, received: ${architectures || "unknown architecture"}`);
}

const buildInfo = execFileSync("xcrun", ["vtool", "-show-build", output], { encoding: "utf8" });
const sidecarMinimumMacOS = buildInfo.match(/^\s*minos\s+(\S+)/m)?.[1];
if (sidecarMinimumMacOS !== minimumMacOSVersion) {
  throw new Error(
    `Expected sidecar minimum macOS ${minimumMacOSVersion}, received ${sidecarMinimumMacOS ?? "unknown"}.`,
  );
}

console.log(`Built ${output}`);
