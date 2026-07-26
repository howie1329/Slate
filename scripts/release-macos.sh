#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
supported_target="aarch64-apple-darwin"

fail() {
  echo "release: $*" >&2
  exit 1
}

[[ "$(uname -s)" == "Darwin" ]] || fail "macOS releases must be built on macOS."
[[ "$(uname -m)" == "arm64" ]] || fail "Slate currently ships only for Apple Silicon."
[[ "$(rustc --print host-tuple)" == "$supported_target" ]] || fail "Rust host must be $supported_target."

cd "$project_root"

export APPLE_SIGNING_IDENTITY="-"
unset APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH
unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID

npm run tauri -- build --target "$supported_target" --bundles dmg
./scripts/verify-macos-release.sh

dmg_path="$project_root/src-tauri/target/$supported_target/release/bundle/dmg/Slate_$(node -p "require('./package.json').version")_aarch64.dmg"
checksum_path="$dmg_path.sha256"

(
  cd "$(dirname "$dmg_path")"
  shasum -a 256 "$(basename "$dmg_path")" > "$(basename "$checksum_path")"
  shasum -a 256 -c "$(basename "$checksum_path")"
)

echo "Created checksum: $checksum_path"
