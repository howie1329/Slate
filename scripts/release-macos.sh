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

[[ -n "${APPLE_SIGNING_IDENTITY:-}" ]] || fail "APPLE_SIGNING_IDENTITY must name an installed Developer ID Application certificate."
[[ "$APPLE_SIGNING_IDENTITY" == "Developer ID Application:"* ]] || fail "APPLE_SIGNING_IDENTITY must be a Developer ID Application identity."

if ! security find-identity -v -p codesigning | grep -Fq "\"$APPLE_SIGNING_IDENTITY\""; then
  fail "APPLE_SIGNING_IDENTITY is not available in the current keychain."
fi

has_api_credentials=false
if [[ -n "${APPLE_API_ISSUER:-}" && -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_PATH:-}" ]]; then
  [[ -r "$APPLE_API_KEY_PATH" ]] || fail "APPLE_API_KEY_PATH does not point to a readable private key file."
  has_api_credentials=true
fi

has_apple_id_credentials=false
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
  has_apple_id_credentials=true
fi

if [[ "$has_api_credentials" != true && "$has_apple_id_credentials" != true ]]; then
  fail "Configure either APPLE_API_ISSUER/APPLE_API_KEY/APPLE_API_KEY_PATH or APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID for notarization."
fi

cd "$project_root"
npm run tauri -- build --target "$supported_target" --bundles dmg
./scripts/verify-macos-release.sh
