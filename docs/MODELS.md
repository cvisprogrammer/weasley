# Model compatibility report

Inspected the installed `@mlc-ai/web-llm@0.2.86` registry before implementing inference. It contains Qwen3.5 at every requested size; no Ollama artifacts or assumed conversions are used.

| Model ID | Registry GPU MB | WASM validation | Actual inference |
| --- | ---: | --- | --- |
| Qwen3.5-0.8B-q4f16_1-MLC | 1629.49 | Valid binary; SHA-256 pinned | Blocked: no WebGPU adapter |
| Qwen3.5-2B-q4f16_1-MLC | 2245.44 | Valid binary; SHA-256 pinned | Blocked: no WebGPU adapter |
| Qwen3.5-4B-q4f16_1-MLC | 3867.82 | Valid binary; SHA-256 pinned | Blocked: no WebGPU adapter |

All selected records are q4f16_1 and have a 4,096-token registry context override. The UI defaults to 2B. Model configuration, tokenizer, and weights must still be downloaded and exercised on target hardware before any model can be described as runtime-verified. Registry GPU estimates are not measured peak process memory. No alternative is advertised as hardware-validated.

Executable library source URLs and model repositories are copied from the installed registry into `dist/registry.json`. Library SHA-256 digests are tracked in `scripts/model-lock.json`; builds reject mismatches. HTTPS verification remains enabled. Runtime library URLs point to packaged extension files. Weight caching uses IndexedDB; eviction can require a later approved reload. No changes to upstream model formats, checksums, or signature verification are made.

Version 0.3 uses instructed chat continuation with `extra_body.enable_thinking: false`, a 64-token internal safety budget, early stopping at sufficient word boundaries and a three-word default display cap. Context is now extracted automatically from relevant rendered same-page text, rather than requiring selection. A tiny generation budget, filtered output and model-state mismatches previously produced silent empty results; the new version exposes each outcome and retries busy work. These are diagnosed code paths, not proof of the exact failure observed on the user's Mac.

Raw completion remains available in the separate research benchmark. Both paths use the same registry libraries. Runtime quality/latency and actual model response formatting still require target-machine validation. Page text is labeled as untrusted data; prompt-level instructions do not guarantee resistance to malicious text or calibrated confidence.
