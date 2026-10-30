# Brii Flow — local typing decoder experiment

## Run

From the existing repository, with Node.js 22+, npm and curl installed:

```sh
npm ci
npm run brii
```

Open `http://127.0.0.1:4173/` (or `/brii.html`) in WebGPU-enabled Chrome. The server only serves static files on loopback; it does not accept text for inference. There is no API key, cloud inference, Python/Ollama service, or Google connection involved. If port 4173 is already serving this checkout, use that server rather than starting a second one.

1. Keep the default **Qwen3.5 · 2B** and click **Load local model**. Wait for Ready. The packaged model library is reused; weights/tokenizers download from Hugging Face on first use and cache in IndexedDB.
2. Type sloppy text and press Space. The default 80 ms debounce batches rapid Spaces. Keep typing while inference runs. Your unfinished suffix is not included in that request.
3. Toggle **Correct after Space** off to type without automatic correction. **Cmd+Enter** (Mac), **Ctrl+Enter** or the Correct button manually completes/corrects the current sentence prefix behind the caret, even without a final Space. A noncollapsed selection prevents a manual request.
4. Use ordinary Undo/Redo. Each correction is a native range replacement, not assignment to `.value` or `setRangeText`. Chrome chooses ordinary typing history groups (e.g. a word and its preceding Space can be separate groups). Undo immediately after a correction restores that raw span while retaining text typed after it. Undo/redo can move the caret to the native edit location; typing after redo follows normal browser selection behavior.
5. The last raw segment, decoded segment, applied/discarded outcome, first output-token timing, inference total and Space/manual-to-result time are shown. Model initialization is reported separately.

Keep the same hostname and port to reuse the playground's model cache. The existing Chrome-extension origin's cache is separate from a standalone HTTP origin, and `localhost` and `127.0.0.1` are also different cache origins. Expect one initial model download for the new playground. Build-time WASM assets remain checksum-verified and bundled locally.

## Minimal changes and preserved infrastructure

Inspection preceded implementation/building. The existing `src/worker.ts` WebWorkerMLCEngineHandler, WebLLM 0.2.86 dependency, registry records, IndexedDB cache configuration, packaged WASM files and `scripts/model-lock.json` checks are reused. The default is still `Qwen3.5-2B-q4f16_1-MLC`; no automatic model change or dependency upgrade was made. `Qwen3.5-0.8B-q4f16_1-MLC` is an explicitly selected smaller speed/quality comparison because it was already supported by this build. Its suitability has not been established by measurements here. The page/JSON export identifies which model was chosen and why.

New files are confined to the standalone Brii entry point, decoder/editing/metrics helpers, page/style/dataset and tests. Existing extension initialization, Gmail code, autocomplete integration and model worker are left in place. The build bundles one additional entry; the static server now defaults `/` to Brii. Legacy URLs still work. The extension itself has **not** been adapted to Brii in this iteration, matching the standalone-first requirement.

## Editing contract

There is one in-flight request plus one coalesced latest boundary, not a request for each Space while busy. Completed spans are corrected progressively: after one span is committed, following spans use its preceding text as context rather than repeatedly regenerating the entire draft. Rapid Spaces before dispatch or during inference form a larger completed chunk. A queued boundary is rebased if an earlier correction changes text length.

A request captures its prefix and edit epoch. Continued appending is allowed; a valid result can replace its unchanged prefix while preserving the newly typed tail. Destructive edits, undo/redo, composition, model/mode changes and resets invalidate stale work. Prefix equality and the current selection are checked again before any write. Overlapping selections, blur and earlier cursor movement prevent application; selections entirely after the span are shifted by the actual UTF-16 length delta, with direction and textarea scroll restored. IME composition never triggers or receives a correction.

Leading/trailing separators are kept outside the decoded span. Line endings are normalized to the textarea's native LF form. Chunks are limited to 600 characters; preceding context is limited to 400. Oversized fused chunks are rejected with a status, never silently clipped. Native editing failure leaves text unchanged instead of using a non-undoable fallback. Corrections are only committed after a complete response; streaming is used for first-token timing, not partial mutation.

The exact requested initial system prompt lives in `src/brii/decoding.ts`. The context and raw text are JSON data in the user message; they are not additional instructions. Generation uses temperature 0 and non-thinking mode. Output budget scales with input length, up to 512 tokens; budget-truncated and obvious chat-wrapper responses are rejected. These guards do not determine intended wording or prevent all hallucinations/paraphrases. Severe corruption is ambiguous, and the reference itself is one possible interpretation. Names, slang, grammar and odd literal meanings need evaluation, not a claim of guaranteed preservation.

## Benchmark

`public/brii-dataset.json` is editable and contains the five required examples verbatim plus the initial fused-sentence example. Edit it and reload, or choose a local dataset JSON file in the page (no upload). JSON needs `version` and `cases`, each with unique `id`, `input` and `expected` fields.

After initialization, click **Run benchmark**. The benchmark pauses automatic correction but leaves raw typing usable, performs one separate warm-up and decodes each case with reset chat state and no reference/context hints. It records:

- First nonempty generated content token and completed-response latency. Timings include chat reset, worker messaging and generation, but exclude initialization, debounce, rendering and human review. Interactive Space/manual-to-result additionally includes debounce and queue delay.
- Strict case/punctuation-sensitive CER (Unicode code-point Levenshtein distance) and WER (whitespace-token Levenshtein distance). Corpus summary rates sum edit counts over reference counts; they are not unweighted means of per-row rates.
- Human-entered unintended semantic-change counts. Blank/null means unreviewed, **not zero**. Count changed meanings, invented details, role reversals or dropped negations by comparing input intent/reference/output. Review mere rewording/tone violations as well; edit distance is not a semantic judge. Partial review totals explicitly state reviewed/unreviewed case counts.

**Export JSON** includes the prompt, dataset/reference/output pairs, chosen model, initialization time, warm-up, per-case timings/error rates, human counts, summary, failures and unrun cases. Malformed, empty or output-budget-truncated model replies are retained with their raw output, timings and validation error and are still scored for CER/WER; the editor would reject them. Transport/worker failures without output are reported separately as failures, not zero error. Stopping or resetting leaves remaining cases unrun. One small six-case run is exploratory, not a stable latency or quality estimate. Export one run per model before switching. Record Mac/GPU, memory and power state when comparing models.

## Available-machine results and limits

The production backend was probed in Chromium on the current Linux cloud machine. It returned **no WebGPU adapter**; `/dev/dri` is absent. No model initialized, and no real inference samples were produced. TTFT, inference latency, CER, WER and semantic-change counts are **unmeasured/null**. Neither the under-100-ms ideal nor the under-300-ms experimental target is claimed. A smaller model cannot fix the missing adapter, so the baseline was not silently switched.

Strict type check, production build and all 24 tests passed. Thirteen Brii browser scenarios passed using explicitly mocked inference: native undo/redo, tail/caret/selection preservation, stale/overlapping-selection rejection, serialized coalescing, untouched unfinished words, IME/whitespace handling, manual mode, undo invalidation, oversized-chunk rejection, benchmark export, explicit human semantic review, and timed-but-unapplied invalid output. Those fixture timings/outputs are not model benchmarks. The production backend's no-adapter failure is tested separately without the mock. Existing typing/mail browser checks also passed, with their pre-existing extension-policy/GPU restrictions reported distinctly.

See [machine-readable Brii checks](brii-results.json). The browser fixture suite does not download weights on GPU-equipped machines; real model quality/timing is obtained through Load + Run benchmark in the actual playground. No calibration, meaning-preservation guarantee, M4 latency claim or hybrid/cloud path is implemented. The immediate next step is to export real 2B and optional 0.8B runs from the target Mac, review semantic changes and decide whether the model/prompt is suitable.

## Commands and file map

```sh
npm run typecheck
npm test
npm run build
npm run serve                 # keep running for browser checks
npm run test:brii-browser     # explicit inference fixtures + real capability probe
```

- `src/brii.ts`: playground/benchmark UI and export.
- `src/brii/engine.ts`: existing WebLLM worker integration, initialization/cache, stream timing, lifecycle.
- `src/brii/flow.ts`: Space debounce, serialized coalescing, stale guards and native edits.
- `src/brii/decoding.ts`: exact baseline prompt, span boundaries and output/selection checks.
- `src/brii/metrics.ts`: dataset validation, CER/WER and benchmark summaries.
- `public/brii.html`, `public/brii.css`, `public/brii-dataset.json`: standalone UI and editable examples.
- `tests/brii*.test.ts`, `scripts/brii-browser-check.mjs`: functional/core/worker/editor/benchmark checks.
- `scripts/build.mjs`, `scripts/serve.mjs`, `package.json`: small build/run additions.
