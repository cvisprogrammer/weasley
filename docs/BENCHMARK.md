# Available-machine validation

Run date: October 25, 2026. Linux x86_64 cloud instance, Node 24.19.0, Chromium 154.0.8037.57. No Apple Silicon hardware is available here.

| Check | Observed result |
| --- | --- |
| TypeScript strict type check | Passed |
| Unit tests | Four passed: exact-origin consent, conservative output filtering, partial-word extraction, hostname-permission/exact-port consent distinction |
| Build | Passed, all entry points bundled |
| Model library compatibility | All three requested Qwen3.5 sizes exist in installed WebLLM 0.2.86 registry |
| WASM integrity | Three modules pass native WebAssembly validation; SHA-256 digests pinned in scripts/model-lock.json |
| Native browser editing | Passed: explicit Tab insertion, undo, Escape dismissal, stale-response invalidation, password exclusion, IME exclusion, partial-word acceptance, other sensitive-field exclusions, and textarea acceptance/undo |
| Typing lab / benchmark HTTP requests | Served successfully |
| Full extension startup | BLOCKED by Chromium administrator policy: “Loading of unpacked extensions is disabled by the administrator.” |
| GPU probe | No WebGPU adapter returned; /dev/dri is absent |
| Actual Qwen3.5-2B benchmark | Attempted; correctly returned “No WebGPU adapter. Inference benchmark cannot run.” No inference samples were produced. |
| Hugging Face model-data request | Proxy CONNECT denied, HTTP 403. Required domains saved to the environment draft; activation not established. |
| M4 performance / human speed | Not measured |

The nine browser editing checks use an explicit mocked inference transport while exercising the production content-script bundle and native Chromium editing. Their suggestion timings are synthetic and are **not** model benchmarks. Real extension routing, offscreen lifecycle, downloads, and inference remain unverified in this environment. The benchmark's adapter-probe duration is not inference latency.

[Machine-readable results](available-machine-results.json) include the real WebGPU benchmark attempt. The test command reports the known administrator restriction separately and continues useful independent checks. Unexpected extension-startup failures are rethrown, rather than disguised as expected policy restrictions.

## Reproduce on supported hardware

Build the extension and start the lab server using README.md. On an extension-permitted Chrome with WebGPU:

1. Load the extension unpacked. Approve a model load in the popup. Confirm download progress and ready status; reload it once more to verify cache reuse.
2. Allow the lab origin and reload the test page. Confirm a real model-generated continuation appears before accepting it. Try typing during inference, changing tabs, password fields, IME input, native undo/redo, and engine reset/reload. Use two allowed tabs to confirm model reuse and tab-scoped cancellation.
3. Open `/benchmark.html` on the lab server. Click the explicit approval button, export the six real samples per model, and compare cold/cached load time and generation TTFT/completion p50/p95. Record GPU/Chrome/macOS versions, memory, battery state, and thermal conditions. Add idle delay and messaging overhead when interpreting pause-to-ghost latency; default idle delay alone is 250 ms. The 200 ms aspiration is not met or claimed by this unmeasured default.
4. In the typing lab, compare assisted and unassisted runs of the same task in both orders. Use popup settings to toggle assistance; the trial selector merely labels results. Record total time, corrected effective WPM, correctness, corrections, accepted/rejected suggestions, and physical keys. Include pauses spent reading predictions. Reject a keystroke-saving result as a speed improvement if total time or correctness worsens.

Phases 2–3 (rich text, distinct alternatives, adaptive/confidence gating, optimization, personalization) remain experiments. No production readiness, sub-200-ms generation, calibrated confidence, or net typing-speed benefit has been established.
