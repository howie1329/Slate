import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sidecarInputFingerprint } from "./binary-inputs.mjs";

const sidecarRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(sidecarRoot, "..");
const targetTriple = execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();
const binary = resolve(projectRoot, "src-tauri/binaries", `slate-ai-sidecar-${targetTriple}`);
const fingerprintFile = `${binary}.sha256`;

try {
  await access(binary, constants.X_OK);
  const [builtFingerprint, currentFingerprint] = await Promise.all([
    readFile(fingerprintFile, "utf8"),
    sidecarInputFingerprint(sidecarRoot),
  ]);

  if (builtFingerprint.trim() !== currentFingerprint) {
    throw new Error("Sidecar binary is stale.");
  }
} catch {
  throw new Error(`Sidecar binary is missing or stale for ${targetTriple}. Run npm --prefix sidecar ci, then npm run build:sidecar.`);
}

console.log(`Using existing ${binary}`);
