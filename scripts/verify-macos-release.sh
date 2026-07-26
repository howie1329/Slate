#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(node -p "JSON.parse(require('fs').readFileSync('$project_root/src-tauri/tauri.conf.json', 'utf8')).version")"
bundle_root="$project_root/src-tauri/target/aarch64-apple-darwin/release/bundle"
dmg_path="$bundle_root/dmg/Slate_${version}_aarch64.dmg"
mount_point="$(mktemp -d /tmp/slate-release.XXXXXX)"
app_path="$mount_point/Slate.app"
app_binary="$app_path/Contents/MacOS/slate"
sidecar_binary="$app_path/Contents/MacOS/slate-ai-sidecar"
info_plist="$app_path/Contents/Info.plist"

fail() {
  echo "verify: $*" >&2
  exit 1
}

[[ -f "$dmg_path" ]] || fail "missing DMG at $dmg_path"

cleanup() {
  hdiutil detach "$mount_point" -quiet >/dev/null 2>&1 || true
  rmdir "$mount_point" >/dev/null 2>&1 || true
}
trap cleanup EXIT

hdiutil attach "$dmg_path" -nobrowse -readonly -mountpoint "$mount_point" -quiet

[[ -d "$app_path" ]] || fail "DMG does not contain Slate.app"
[[ -x "$app_binary" ]] || fail "missing app executable"
[[ -x "$sidecar_binary" ]] || fail "missing sidecar executable"

[[ "$(plutil -extract CFBundleIdentifier raw "$info_plist")" == "com.howardthomas.slate" ]] || fail "unexpected bundle identifier"
[[ "$(plutil -extract CFBundleShortVersionString raw "$info_plist")" == "$version" ]] || fail "bundle version does not match Tauri configuration"
[[ "$(plutil -extract LSMinimumSystemVersion raw "$info_plist")" == "13.5" ]] || fail "bundle minimum macOS version must be 13.5"

for binary in "$app_binary" "$sidecar_binary"; do
  [[ "$(lipo -archs "$binary")" == "arm64" ]] || fail "$binary is not arm64-only"
  minimum_macos="$(xcrun vtool -show-build "$binary" | awk '$1 == "minos" { print $2; exit }')"
  [[ "$minimum_macos" == "13.5" ]] || fail "$binary requires macOS ${minimum_macos:-unknown}, expected 13.5"
  codesign --verify --strict --verbose=2 "$binary"
done

codesign --verify --deep --strict --verbose=2 "$app_path"

app_signature="$(codesign -dvvv "$app_path" 2>&1)"
sidecar_signature="$(codesign -dvvv "$sidecar_binary" 2>&1)"
grep -q "^Signature=adhoc$" <<<"$app_signature" || fail "app is not ad-hoc signed"
grep -q "^Signature=adhoc$" <<<"$sidecar_signature" || fail "sidecar is not ad-hoc signed"

sidecar_response="$(printf '{}\n' | "$sidecar_binary")"
[[ "$sidecar_response" == '{"ok":false,"error":{"category":"invalid-request"}}' ]] || fail "ad-hoc-signed sidecar failed its runtime smoke test"

echo "Verified ad-hoc-signed release: $dmg_path"
