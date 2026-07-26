# macOS distribution

Slate is distributed directly as an ad-hoc-signed DMG. This path does not require an Apple Developer Program membership, but macOS cannot verify the publisher or notarization status. Users must explicitly approve the first launch.

Mac App Store distribution is not supported because the native popover shell depends on Tauri's `macOSPrivateApi`.

## Supported systems

- Processor: Apple Silicon (`arm64`)
- Operating system: macOS 13.5 or later
- Artifact: Ad-hoc-signed DMG

The bundled Node sidecar sets the macOS 13.5 floor. The Tauri app plist, Rust deployment target, and sidecar build are checked against the same version during the release workflow. Intel and universal artifacts remain out of scope until Slate can build and test the complete app and sidecar stack on `x86_64`.

## Security tradeoff

Ad-hoc signing protects the internal code-signing structure of the app bundle, but it does not identify the publisher and is not a substitute for Apple notarization. macOS Gatekeeper will warn users that Apple cannot verify the app.

Publish a SHA-256 checksum beside every DMG so users can verify the downloaded artifact before overriding macOS security.

## Build and verify

Run:

```sh
npm run release:macos
```

The command requires an Apple Silicon Mac, forces Tauri's ad-hoc signing identity (`-`), and disables notarization credentials for a deterministic free release. The verification step then checks:

- production bundle identity, version, architecture, and macOS deployment target;
- valid ad-hoc signatures on the app and sidecar;
- the hardened-runtime sidecar can start successfully;
- the DMG contains the expected application bundle.

The workflow does not claim Developer ID identity, notarization, stapling, or Gatekeeper acceptance.

The release artifacts are written to:

```text
src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Slate_<version>_aarch64.dmg
src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Slate_<version>_aarch64.dmg.sha256
```

## First launch

After downloading and installing Slate, try to open it once. If macOS blocks the app:

1. Open **System Settings → Privacy & Security**.
2. Scroll to **Security**.
3. Click **Open Anyway** for Slate.
4. Confirm **Open** and enter the Mac login password if prompted.

macOS saves this approval as an exception for future launches. Users should only override the warning for a DMG obtained from Slate's official GitHub release and whose checksum matches the published SHA-256 value.
