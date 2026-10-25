# Available-machine validation

Run date: October 25, 2026. Linux x86_64 cloud instance, Node 24.19.0, Chromium 154.0.8037.57. No Apple Silicon hardware is available here.

| Check | Observed result |
| --- | --- |
| TypeScript strict type check | Passed |
| Unit tests | Nine passed: consent/filtering/word-boundary utilities plus offscreen lifecycle and internal-page authorization tests using mocked inference/Chrome APIs |
| Build | Passed, all entry points bundled |
| Model library compatibility | All three requested Qwen3.5 sizes exist in installed WebLLM 0.2.86 registry |
| WASM integrity | Three modules pass native WebAssembly validation; SHA-256 digests pinned in scripts/model-lock.json |
| Native browser editing | Passed: explicit Tab insertion, undo, Escape dismissal, stale-response invalidation, password exclusion, IME exclusion, partial-word acceptance, other sensitive-field exclusions, textarea acceptance/undo, and automatic-context filtering (including CSS visibility/opacity), busy retries, simple-page structure and visible error handling |
| Typing lab / benchmark HTTP requests | Served successfully |
| Full extension startup | BLOCKED by Chromium administrator policy: “Loading of unpacked extensions is disabled by the administrator.” |
| GPU probe | No WebGPU adapter returned; /dev/dri is absent |
| Actual Qwen3.5-2B benchmark | Attempted; correctly returned “No WebGPU adapter. Inference benchmark cannot run.” No inference samples were produced. |
| Hugging Face model-data request | Proxy CONNECT denied, HTTP 403. Required domains saved to the environment draft; activation not established. |
| M4 performance / human speed | Not measured |

The browser editing and context checks use an explicit mocked inference transport while exercising the production content-script bundle and native Chromium editing. Their suggestion timings are synthetic and are **not** model benchmarks. Real extension routing, offscreen lifecycle, downloads, and inference remain unverified in this environment. The benchmark's adapter-probe duration is not inference latency.

[Machine-readable results](available-machine-results.json) include the real WebGPU benchmark attempt. The test command reports the known administrator restriction separately and continues useful independent checks. Unexpected extension-startup failures are rethrown, rather than disguised as expected policy restrictions.

## Reproduce on supported hardware

Load version 0.3 on a target Mac. Open Weasley, load the model and click Try it. The bundled test runs directly inside the extension: no Terminal, server, selection, trial labels or start/stop buttons. Type in its single textarea beneath the preamble. Confirm the suggestion uses the stated Friday/noon meeting context, and read the status line if nothing appears. Also verify Tab, Escape, native undo/redo and typing during inference.

For an allowed external page, confirm automatic context includes relevant rendered passages and excludes navigation, hidden/private text, controls and other drafts. Test both an already-allowed tab and the built-in test. Reloading the extension requires reloading the model from cache; switching models requires Load. Use GPU reset/reload after a device/worker failure.

The optional separate benchmark is still served with `npm run serve` at `/benchmark.html`. It uses fixed prompts and fixed background, not arbitrary browsing text. It compares instructed continuation (64-token safety budget, early word stop) against raw completion, exports six real samples per model and reports cold/cached load time and TTFT/completion p50/p95. Record GPU/macOS/Chrome version, memory, battery and thermal state. Inference timings exclude the default 250 ms idle delay and messaging overhead.

The old transcription/trial controls were removed from the primary page as requested. Numeric popup counters remain diagnostic estimates; no human words-per-minute or net typing-time benefit has been established. Future controlled studies should compare total elapsed time and correctness, including the cost of reading rejected suggestions.

Version 0.3 specifically addresses silent failure handling and simplifies interaction. It does not establish that the exact Mac failure was reproduced or that real model quality improved. Full extension/GPU testing remains blocked in this cloud environment. Rich text, distinct alternatives, calibrated confidence gating, optimization and personalization remain future work.
