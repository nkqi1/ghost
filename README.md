# Ghost Browser for Apple Silicon Macs

A minimal tabbed browser based on Electron/Chromium, with **experimental** Chrome Web Store extension ID installation and loading of unpacked Chrome extensions.

## Requirements
- Apple Silicon Mac (M1 or newer)
- macOS with Node.js 20+ and npm installed

## Build a drag-to-Applications DMG

```bash
cd ghost-browser
npm install
npm run dist
```

Find the generated `.dmg` inside `dist/`. Open it and drag **Ghost Browser.app** into Applications. Alternatively run `npm start` to test without building.

**Important:** The build is unsigned and not notarized. macOS Gatekeeper may block it. Only run apps you built and trust; you may need to use Finder's Open context menu or System Settings → Privacy & Security → Open Anyway. Do not disable Gatekeeper globally.

## Extensions

Click ◇, paste the **32-character extension ID** from the Chrome Web Store URL, and click Install. Alternatively click Load unpacked extension to select a local folder containing `manifest.json`.

**Limitations:** Electron's `session.loadExtension` only implements a subset of Chrome extension APIs, and many Manifest V3 extensions will not work. Google can change or block the CRX download endpoint. The Chrome Web Store's own **Add to Chrome** button is not integrated. Extension UI (toolbar popup/action buttons) is not implemented. Chrome extension installation is experimental, **not full Chrome Web Store compatibility**. Do not assume password managers, privacy tools, or security-critical extensions work correctly.

## Security and development notes

- Browser content is isolated in sandboxed BrowserViews with Node integration disabled.
- Permissions are denied by default except fullscreen and sanitized clipboard write.
- Downloaded extension code is third-party code: only install extensions you trust.
- No auto-update or code-signing infrastructure is included.
- This is a prototype, not a security-hardened replacement for a maintained browser.
- Chromium/Electron must be updated regularly to receive security fixes.

## Build a macOS DMG with GitHub Actions (no local Node.js)

1. Create a new GitHub repository (private is fine). Choose **not** to initialize it with a README.
2. Upload the **contents** of the `ghost-browser` folder, including the hidden `.github/workflows/build-macos.yml` file. GitHub's web uploader may not preserve hidden files reliably; check that the workflow file appears in the repository. Alternatively upload files via Git on your Mac.
3. Ensure the default branch is `main` (or change the workflow branch trigger accordingly).
4. Open **Actions** > **Build Ghost Browser for Apple Silicon** > **Run workflow**. The workflow also starts on pushes to `main`.
5. After the run finishes, open its page and download the `Ghost-Browser-Apple-Silicon-DMG` artifact ZIP. Unzip it, open the DMG, and drag Ghost Browser into Applications.

The workflow runs on a GitHub-hosted macOS runner and packages an arm64 DMG. The application is **unsigned and not notarized**, so Gatekeeper may block it until explicitly approved in System Settings > Privacy & Security. Only approve apps you trust. Chrome Web Store extension support is experimental, not guaranteed. GitHub Actions availability, minutes, and macOS runner selection depend on repository/account settings.
