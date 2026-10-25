# Weasley

Private, on-device predictive typing for Chrome. Manifest V3, TypeScript, WebLLM 0.2.86 and WebGPU. No account, API key, inference server or telemetry. Default model: Qwen3.5-2B; default suggestion: at most three words after a 250 ms pause.

## Try it

1. Unzip `artifacts/weasley-0.3.0.zip`. In `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the folder containing `manifest.json`.
2. Open Weasley, select a model, and click **Download / load model**. Approve the initial download by clicking this button; weights/tokenizers are then cached locally. Wait for Ready.
3. Click **Try it**. The bundled page has a short preamble, one textarea and a status line. No server, text selection, trial buttons or assisted/unassisted controls are needed.
4. Type `The design review is scheduled for ` and pause. The model receives the relevant preamble automatically. **Tab** accepts; **Alt+Right** accepts a word; **Escape** dismisses. Native editing preserves undo/redo.

When upgrading, **replace the contents of your existing extension folder**, then click Reload in `chrome://extensions`. Keeping the same folder preserves extension identity and its cached data. Load the model again after extension reload; it should use the cache. Existing model preferences are retained. Legacy raw-mode/token-budget preferences are no longer used by the extension's default path.

For other websites, add their origin in the popup, grant the permission, then reload the page. Ordinary text inputs and textareas only; ChatGPT's contenteditable editor is not supported. Chrome grants host-level permissions across ports, while Weasley separately enforces exact allowed origins. The extension's own bundled test page is trusted directly; it cannot grant permission to any other webpage.

## Automatic context

After a typing pause, Weasley scans rendered text on the current **allowed** page. It starts with nearby preceding elements and the field's containing section, then samples the main/article area and body within bounded work (up to 1,000 text nodes and a nominal 10 ms scan budget). It scores passages by meaningful-word overlap with the draft and structural proximity, deduplicates them, and sends at most 1,200 characters with the last 1,800 characters of the current field. A short per-field cache avoids rescanning on every keystroke.

Input values, other drafts/editable regions, labels/controls, navigation, menus, hidden or transparent text, `data-private` sections and extension UI are excluded. This is deterministic relevance filtering, not an additional semantic model. It may miss a distant useful passage or include an unrelated visible passage. The nominal scan budget is checked between nodes and is not a hard real-time guarantee. See Advanced settings for the actual context excerpt used. No other page or tab is fetched, and context is not saved to disk or uploaded.

The worker labels the context and draft as untrusted data. Prompt instructions reduce instruction confusion but do not guarantee resistance to malicious page text. Only enable websites whose visible content you want processed locally. Sensitive-field detection is conservative and cannot semantically classify arbitrary free text.

## Prediction and diagnostics

Instructed continuation uses non-thinking mode, low temperature, and a 64-token internal safety budget. It stops early once enough word boundaries are available; the displayed suggestion remains capped to three words by default. A larger internal budget avoids exhausting a tiny token allowance before a useful response appears. Conversational replies, markup, repetition and truncated final words are filtered; a useful first line can be retained without a later explanation. None of this is calibrated confidence estimation.

The test page reports waiting, predicting, filtered/empty output, a model-selection mismatch, unloaded model, connection failure or timeout. A busy model is retried for a bounded interval if the draft is still current. Obsolete predictions are invalidated and interrupted; cancellation is scoped to the requesting tab/document. Advanced settings retain word length, delay, GPU reset, context preview and numeric diagnostics.

If no suggestion appears, **read the status line beneath the textarea**. If it says the model is not loaded or the selected model differs, load it from the popup. After a device/worker failure, use Advanced → Release GPU / reset engine, then Load. If it says output was filtered, report that message: model quality still needs target-hardware testing.

## Architecture and privacy

The service worker validates sender identity and website consent and creates one offscreen document with Chrome's WORKERS reason. That document uses only Chrome's supported runtime API and owns one dedicated inference worker shared across fields/tabs. Inference does not run on the page thread. Each request resets conversation state so context does not carry across fields/tabs. Browser/extension restart or process reclamation can require model reload; service-worker suspension alone need not recreate the offscreen model.

Model data downloads from Hugging Face only after the load action. Executable WASM libraries ship in the ZIP, are validated/checksum-pinned at build time, and are never fetched as remote extension code. CSP restricts scripts/workers to local files and model-data connections to Hugging Face hosts. There is no cloud inference or telemetry. Settings, allowed origins, cached model data and up to 500 numeric performance events are stored locally. Typed text and harvested context are not included in stored diagnostics or HTTP requests. See [privacy disclosure](docs/PRIVACY.md).

There is no iframe, shadow-root editor, contenteditable, selected-text or mid-field support. Ghost placement assumes ordinary left-to-right horizontal fields and may misalign under unusual transforms/writing modes. Ghost text is aria-hidden and captures no pointer input. Host websites retain their normal access to their own fields.

## Development and verification

Requires Node.js 22+, npm, curl and zip. Use the existing checkout; no Git worktree is needed.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run package
```

The ZIP has `manifest.json` at its root. It is a prototype distribution candidate, not a Chrome Web Store submission/approval.

For automated browser checks or the separate optional benchmark, run `npm run serve`, then `npm run test:browser` in another terminal. On macOS set `CHROME_PATH` to the Chrome executable. The server is a test-file server, never an inference server; it is unnecessary for the popup's built-in Try it page.

`http://localhost:4173/benchmark.html` is a separate research tool with fixed prompts and fixed relevant context. It exports load time and six TTFT/completion samples with p50/p95; raw completion remains available there as a comparison. It does not claim human typing-speed improvements. Numeric acceptance/key-saving diagnostics are estimates and do not establish time saved; reading suggestions can cost more time than accepting them saves.

The cloud machine blocks unpacked extensions by administrator policy and has no WebGPU adapter. Unit tests simulate the inference backend to exercise real routing/lifecycle behavior; browser editing/context tests mock inference. Real model quality, full extension startup, M4 latency and net typing-speed benefit remain unverified here. See [validation evidence](docs/BENCHMARK.md) and [model compatibility](docs/MODELS.md).

Next experiments: target-machine debugging/quality measurement, editor-specific email-thread extraction, contenteditable support, calibrated suppression and comparative model benchmarks. Before store submission, complete target-Mac validation, icons/screenshots, permission/privacy disclosures and model/library license review.
