# macOS distribution

Slate is distributed directly as a notarized DMG. Mac App Store distribution is not supported because the native popover shell depends on Tauri's `macOSPrivateApi`.

## Supported systems

- Processor: Apple Silicon (`arm64`)
- Operating system: macOS 13.5 or later
- Artifact: Developer ID signed, notarized, and stapled DMG

The bundled Node sidecar sets the macOS 13.5 floor. The Tauri app plist, Rust deployment target, and sidecar build are checked against the same version during the release workflow. Intel and universal artifacts remain out of scope until Slate can build and test the complete app and sidecar stack on `x86_64`.

## Apple prerequisites

Install a valid **Developer ID Application** certificate and its private key in the signing keychain. Confirm it appears in:

```sh
security find-identity -v -p codesigning
```

Set `APPLE_SIGNING_IDENTITY` to the full certificate name. Configure notarization with one of the credential sets supported by Tauri:

- App Store Connect API: `APPLE_API_ISSUER`, `APPLE_API_KEY`, and `APPLE_API_KEY_PATH`
- Apple ID: `APPLE_ID`, `APPLE_PASSWORD` using an app-specific password, and `APPLE_TEAM_ID`

Keep these values in the shell environment or a secure CI secret store. Do not commit them or place them in a local project file.

## Build and verify

Run:

```sh
npm run release:macos
```

The command refuses to build without an Apple Silicon host, the configured Developer ID identity, and notarization credentials. Tauri builds the sidecar and app, signs them with hardened runtime, submits the DMG for notarization, and staples the result. The verification step then checks:

- production bundle identity, version, architecture, and macOS deployment target;
- strict Developer ID signatures on the app and sidecar;
- the hardened-runtime sidecar can start successfully;
- notarization tickets are stapled to the app and DMG;
- Gatekeeper accepts both the app and DMG.

The release artifact is written to:

```text
src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Slate_<version>_aarch64.dmg
```
