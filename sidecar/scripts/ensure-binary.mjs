import { access, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sidecarRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(sidecarRoot, "..");
const targetTriple = execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();
const binary = resolve(projectRoot, "src-tauri/binaries", `slate-ai-sidecar-${targetTriple}`);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : path;
  }));
  return paths.flat();
}

try {
  await access(binary, constants.X_OK);
  const binaryModifiedAt = (await stat(binary)).mtimeMs;
  const inputs = [
    resolve(sidecarRoot, "package.json"),
    resolve(sidecarRoot, "package-lock.json"),
    resolve(sidecarRoot, "tsconfig.json"),
    ...await listFiles(resolve(sidecarRoot, "scripts")),
    ...await listFiles(resolve(sidecarRoot, "src")),
  ];

  for (const input of inputs) {
    if ((await stat(input)).mtimeMs > binaryModifiedAt) {
      throw new Error("Sidecar binary is stale.");
    }
  }
} catch {
  throw new Error(`Sidecar binary is missing or stale for ${targetTriple}. Run npm run build:sidecar first.`);
}

console.log(`Using existing ${binary}`);
