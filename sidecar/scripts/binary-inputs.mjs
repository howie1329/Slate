import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : path;
  }));
  return paths.flat();
}

export async function sidecarInputFingerprint(sidecarRoot) {
  const inputs = [
    resolve(sidecarRoot, "package.json"),
    resolve(sidecarRoot, "package-lock.json"),
    resolve(sidecarRoot, "tsconfig.json"),
    ...await listFiles(resolve(sidecarRoot, "scripts")),
    ...await listFiles(resolve(sidecarRoot, "src")),
  ].sort();
  const hash = createHash("sha256");

  for (const input of inputs) {
    hash.update(relative(sidecarRoot, input));
    hash.update("\0");
    hash.update(await readFile(input));
    hash.update("\0");
  }

  return hash.digest("hex");
}
