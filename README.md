# Weasley

A Manifest V3 Chrome extension for browser-native predictive typing. TypeScript + WebLLM 0.2.86 + WebGPU; no server, account, API key, or telemetry. Default: Qwen3.5-2B, 10 generated tokens, 250 ms idle delay. This is a Phase 1 prototype, not a validated typing-speed improvement.

## Build and load on macOS

Requires Node.js 22+, npm, curl, zip, and a current Chrome with WebGPU (including Apple Silicon). Use the existing checkout; no worktree is needed.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run serve
```

1. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this repository's `dist` directory.
2. Open the extension popup. Select a model and click **Approve download / load**. Model weights/tokenizers download from Hugging Face once per model, then use IndexedDB cache. Keep Chrome open during the first load. GPU memory estimates are displayed; close other GPU-heavy applications if needed.
3. Add `http://localhost:4173` to the explicit website allowlist and grant Chrome's permission request. Open `http://localhost:4173/test.html`, or reload it if already open. Other websites require their own exact origin allowlist entry. Chrome grants hostname-level access across ports; the extension separately enforces exact origins including ports before reading fields.
4. Type an unfinished sentence in an ordinary text input or textarea. Pause. A suggestion appears in faint text without changing the field. **Tab** accepts it, **Alt+Right** accepts the next word, **Escape** dismisses it. Typing, cursor movement, focus changes, and composition invalidate obsolete suggestions. Tab retains normal navigation when no suggestion is available. Alt+Right is intercepted only with an active suggestion; it otherwise retains the host's behavior.
5. Native Chrome `insertText` editing preserves undo. If a website/browser rejects native insertion, the extension does not fall back to a direct value mutation that would break undo. Some controlled editors can still reject native events.

`npm run package` produces `artifacts/weasley-0.1.0.zip`; its root contains `manifest.json`. Unzip it before loading unpacked. It is a distribution candidate, not a Chrome Web Store submission or approval.

## Architecture and privacy

The service worker validates extension message senders and website origins, registers content scripts only on permitted websites, and creates one offscreen document using Chrome's WORKERS reason. That document holds a dedicated WebLLM worker and a single shared model instance for all supported tabs and fields. Typing never runs inference on a page's main thread. Busy inference is skipped rather than queued; obsolete work is interrupted, and results carry page-side generation guards. Cancellation is scoped to the requesting tab. Text is capped to the preceding 1,800 characters.

Raw text completion bypasses chat/thinking templates. Generation is low-temperature, capped at 5–15 tokens, and stopped at a newline or model boundary. A conservative filter rejects markup, thinking tags, and common conversational prefixes. These are heuristics, not calibrated confidence estimates. Streaming measures first-token latency internally; ghost text appears after generation completes to avoid flashing partial suggestions.

The extension requires explicit model-download approval and an initially empty, exact-origin website allowlist. Text is processed locally and is never included in HTTP requests, storage, logs, or telemetry. Only numeric, bounded aggregate events are stored by the extension. The lab saves numeric trial results in its page-local storage. Host permissions for Hugging Face permit model-data requests; executable WASM libraries are bundled in `dist/models`, checked against tracked SHA-256 digests, and never downloaded by the installed extension. Scripts/workers are bundled locally; CSP permits local WASM compilation and restricts connections to model-data hosts. Dependency/code updates require a new build.

Password, email, number, telephone, and other non-text/search input types are excluded. Autocomplete, field names/IDs/ARIA labels, and a `data-private` ancestor provide additional sensitive-field exclusions. Arbitrary free text cannot be semantically classified as sensitive: the website allowlist is the primary consent boundary. No contenteditable, shadow-root field, iframe, mid-field, selected-text, or rich-editor support yet. The prototype is intended for ordinary left-to-right horizontal fields; unusual transforms/writing modes may misalign the overlay. Ghost text is aria-hidden and never shifts layout or captures pointer input.

**Release GPU / reset engine** terminates the offscreen worker and frees its model instance while retaining cached data. Reload through the popup after device loss, worker failure, browser restart, or extension reload. Chrome service-worker suspension alone does not require reloading the offscreen model. Offscreen contexts/processes can still be reclaimed under memory pressure; live processes are not durable storage. Startup makes no silent model download.

## Validation and experiments

```sh
npm run typecheck
npm test
# In another terminal, leave npm run serve running:
npm run test:browser
```

Browser checks use the installed Chromium on Linux. On a Mac set `CHROME_PATH` to the Chrome executable for the check command. Automated editing tests mock inference explicitly and exercise real native browser input and undo. Their JSON distinguishes extension-policy blockers from passed editing tests; exit success does not imply model inference passed. See [available-machine results](docs/BENCHMARK.md).

For real inference, visit `http://localhost:4173/benchmark.html`. Explicitly approve a download, then export the six fixed-prompt samples, TTFT and completed-suggestion p50/p95, and load time. Repeat per model on the actual target Mac. Load time includes download/cache access; inference timings exclude idle delay and page messaging. Cold first-generation samples are retained and labeled by round. No model-selection option has been hardware-validated on this cloud machine; registry compatibility and WASM integrity are verified, as detailed in [model compatibility](docs/MODELS.md).

For typing-speed evaluation, use the lab's identical transcription task with assistance disabled and enabled in the extension popup. The trial selector is a label and does not change extension settings. Read the task before starting. Record total elapsed time (including pauses and corrections), physical key events, correction keys, correctness, and effective WPM. Repeat in reverse order and use multiple trials: practice and reading overhead can outweigh keystrokes saved. Popup counters report shown/accepted/rejected suggestions, mean inference latency and suggestion length, and estimated keys saved. They are a rolling 500-event diagnostic, not a controlled acceptance-rate study; partial acceptance and unresolved suggestions can bias the ratios. Key savings are estimates, not elapsed-time savings.

## Current limits and next experiments

Cloud Chromium administrator policy blocks unpacked-extension loading; the machine exposes no WebGPU adapter, and Hugging Face access was denied by its network proxy. Therefore full extension startup, actual model downloads/inference, prediction quality, M4 performance, and human typing-speed improvement remain unverified. The compiled extension and native editing loop have independent validation. Model download domains were saved in the cloud environment draft; review/save and publish through environment settings to activate that configuration. A GPU-enabled, extension-permitted Chrome is still needed.

Phase 2 remains: rich-text support, distinct alternative candidates (the UI marks this unavailable), adaptive phrase length, confidence-based suppression, and user studies for distraction. Phase 3 remains: cross-model latency/quality comparisons, context-cache optimization, and local personalization. Do not treat generation probabilities as calibrated acceptance probabilities or enable personalization before establishing that it saves time.

Before Chrome Web Store submission: validate the complete flow on target Macs, supply icons/screenshots and publisher details, review model/library redistribution licenses and notices, publish a privacy policy from `docs/PRIVACY.md`, justify permissions, and verify current store policies. No store publication has been performed.
