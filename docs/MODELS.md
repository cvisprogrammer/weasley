# Model compatibility report

Inspected the installed `@mlc-ai/web-llm@0.2.86` registry before implementing inference. It contains Qwen3.5 at every requested size; no Ollama artifacts or assumed conversions are used.

| Model ID | Registry GPU MB | WASM validation | Actual inference |
| --- | ---: | --- | --- |
| Qwen3.5-0.8B-q4f16_1-MLC | 1629.49 | Valid binary; SHA-256 pinned | Blocked: no WebGPU adapter |
| Qwen3.5-2B-q4f16_1-MLC | 2245.44 | Valid binary; SHA-256 pinned | Blocked: no WebGPU adapter |
| Qwen3.5-4B-q4f16_1-MLC | 3867.82 | Valid binary; SHA-256 pinned | Blocked: no WebGPU adapter |

All selected records are q4f16_1 and have a 4,096-token registry context override. The UI defaults to 2B. Model configuration, tokenizer, and weights must still be downloaded and exercised on target hardware before any model can be described as runtime-verified. Registry GPU estimates are not measured peak process memory. No alternative is advertised as hardware-validated.

Executable library source URLs and model repositories are copied from the installed registry into `dist/registry.json`. Library SHA-256 digests are tracked in `scripts/model-lock.json`; builds reject mismatches. HTTPS verification remains enabled. Runtime library URLs point to packaged extension files. Weight caching uses IndexedDB; eviction can require a later approved reload. No changes to upstream model formats, checksums, or signature verification are made.

Raw completion uses the field prefix directly, rather than an assistant prompt, so it does not invoke a thinking chat template. Output filters suppress tagged thinking/chat artifacts but do not establish output quality or calibrated confidence. Actual prompt-completion behavior remains a required target-machine test.
