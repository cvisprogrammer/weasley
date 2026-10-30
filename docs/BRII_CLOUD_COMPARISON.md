# Cloud decoder comparison

The user ran the saved three-case benchmark locally and supplied these outputs. Each strategy/model has one sample per case. These are user-reported live results; the cloud workspace did not make or independently reproduce the API calls. Network conditions, provider load, warm-up and run order were not controlled.

| Model / prompt | Have case (ms) | Try-again case (ms) | Casual wording (ms) | Observed quality |
| --- | ---: | ---: | ---: | --- |
| gpt-4.1-mini / raw-only | 5316 | 4176 | 718 | Spelling recovered in first case, but apostrophes missing in first/third |
| gpt-4.1-mini / raw + draft | 1152 | 1021 | 1287 | Reintroduced `hva`, `agiang`, `agina`; lost apostrophes |
| gpt-4.1 / raw-only | 770 | 985 | 718 | Recovered wording and contractions in all three examples |
| gpt-4.1 / raw + draft | 663 | 974 | 1151 | Reintroduced `hve`, `agian`, `agina` in the first example |

GPT-4.1 with the original raw-only prompt is the selected default. Its observed latency range here was 718–985 ms (median 770 ms). This is not a latency distribution, a validated accuracy score, or proof that it will outperform mini on every input. The draft-aware experiment is rejected for normal editing because it regressed on the motivating example with both models. It remains available in the benchmark for further comparison.

The default model changed from GPT-4.1-mini for this evidence-based quality comparison; no sampling parameters or editing triggers changed. `OPENAI_MODEL` still overrides the default. Normal inference sends original raw typing plus preceding context; the displayed draft remains diagnostic text, not model input. The 12-word moving window, sentence pause, protected edits, native Undo and stale-response checks remain in place.

Use `npm run benchmark:cloud` with a key configured to rerun both prompts on GPT-4.1, or `OPENAI_MODEL=gpt-4.1-mini npm run benchmark:cloud` to rerun mini. Each command makes six billable requests and overwrites the local comparison JSON. The editable cases are in `public/brii-revision-dataset.json`.
