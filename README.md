# Brii Flow

Brii reconstructs sloppy typing using the original cloud decoder prompt and **gpt-4.1-mini**. The default Chrome extension now uses a small loopback helper; the API key stays in that helper, outside Chrome. Cloud correction is off until you enable it and allow a website.

## Run from source

Requires Node 22+ and Chrome.

```sh
npm ci
npm run build
export OPENAI_API_KEY='your-key'
npm run cloud
```

Enter your key in your own terminal; do not send it in chat. Open `chrome://extensions`, enable Developer mode, and Load unpacked → select `dist`. Disable the old Weasley extension to avoid overlapping editing. The Brii build has a stable new extension identity.

Open the Brii popup, enable cloud correction, and click **Allow this website** on a page you want to use. **Try Brii** opens the playground. Alternatively open `http://127.0.0.1:3001/` to try the same decoder without installing the extension. Keep the helper running. Set `OPENAI_MODEL` before starting it to override the default model.

## Use the downloadable ZIP

Extract `artifacts/brii-flow-0.5.0.zip`. In a terminal inside the extracted folder:

```sh
export OPENAI_API_KEY='your-key'
node cloud-server.mjs
```

Load that same extracted folder with Chrome's **Load unpacked**. No npm install or build is needed for the ZIP. The extension alone cannot call OpenAI without the running helper.

## Editing and privacy

Space triggers correction after a short configurable delay; Cmd/Ctrl+Enter corrects manually. One pending request coalesces later Spaces, typing continues, edits invalidate stale results, and ordinary Undo reverses a correction. Only completed text behind the cursor is corrected. The popup can disable automatic correction or remove allowed sites.

**Supported: ordinary text inputs and textareas. Rich `contenteditable` editors, ChatGPT's composer, Google Docs, and Gmail composing are not supported yet.** They need editor-specific integration to preserve formatting and undo. Password and sensitive fields are excluded.

On allowed sites, completed text (up to 600 characters) and up to 400 preceding characters from the same field go to OpenAI through the loopback helper. There is no webpage harvesting. Cloud corrections may incur API charges. Requests use `store:false`; that does not imply zero provider retention. No API key or text is persistently saved by Brii. Disabling cloud correction stops new requests and aborts pending requests where possible; it cannot retract text already sent.

The helper binds only to 127.0.0.1, checks the extension's public identity, validates Host/Origin, and never accepts a caller-supplied upstream URL. These checks protect against ordinary website requests, not other programs running on your computer.

## Verification and limitations

```sh
npm run typecheck
npm test
npm run build
npm run test:cloud-browser
npm run package
```

The cloud tests use an explicit fake provider. Browser checks cover opt-in, website gating, native Undo, continued typing, caret preservation, and excluded fields. No OpenAI key is configured in the cloud workspace, so live decoding quality and actual cloud latency are **unmeasured**. The UI reports end-to-end latency; this non-streaming path does not measure first-token latency. Unpacked extension installation is blocked by the workspace's Chromium administrator policy; the real content bundle is browser-tested with simulated Chrome transport.

## Preserved local experiment

`npm run brii` still opens the standalone WebLLM experiment at `http://127.0.0.1:4173/`. It retains Qwen3.5-2B, the optional 0.8B comparison, editable `public/brii-dataset.json`, and benchmark exports. It is separate from the default cloud extension. This workspace has no WebGPU adapter, so real local inference performance remains unmeasured. See [local experiment guide](docs/BRII.md).

The previous Gmail extension sources remain for research; `public/legacy-manifest.json` preserves the old manifest. The default package no longer exposes that product or requests Gmail access. The historical documentation below describes that older build.

---

# Weasley — Needs your reply

A local-model Gmail assistant that flags unresolved email requests with supporting quotes. It keeps Google's **Important** marker intact and adds a separate **↩ Reply** indicator beside supported Gmail inbox subjects. No developer backend, cloud inference, email sending, or Gmail label changes.

## Try v0.4

1. Download/unzip `artifacts/weasley-0.4.0.zip`. Replace the contents of your **existing** extension folder and click Reload in `chrome://extensions`; keeping the same path preserves extension identity and model cache. For a new installation, enable Developer mode → Load unpacked → select the folder containing `manifest.json`.
2. Open Weasley → **Open Needs your reply**. Choose **Balanced 2B** and load the model. The first load downloads model data from Hugging Face; subsequent loads use the local cache.
3. Click **Try sample inbox** to classify fictional mail without connecting Google. Samples use your real local model; they are not claimed to be real Gmail messages or prevalidated model results.
4. To connect real Gmail, follow the built-in one-time Google setup helper or [Google setup guide](docs/GOOGLE_SETUP.md). It displays the extension ID and generates a configured manifest from a public Chrome Extension OAuth client ID. No client secret is used. The distributable intentionally has no OAuth client configured.
5. Connect Gmail, check the displayed account, then click **Scan Primary inbox**. Each scan checks up to 20 Primary inbox threads. Review Reply flags and their exact supporting quotes, dismiss mistakes with **Not needed**, or open the original thread in Gmail.

Badges appear only for scanned, API-matched threads on the same Gmail account, and only in supported DOM layouts. They expire after 15 minutes or observed row changes. No badge does not mean no response is needed. A local dashboard remains available even when the Gmail UI adapter cannot identify a row/account.

## How it decides

The Gmail API reads full thread MIME data with `gmail.readonly`. A pure HTML parser extracts text without rendering email HTML or loading tracking images, scripts, links or attachments. It prefers plain-text alternatives, handles declared text charset, removes common quoted blocks and bounds the latest message to 2,400 characters plus three short history messages. Truncated/missing latest text is sent to Review, not silently marked clear. Older history can be shortened and is labeled accordingly.

Ordinary code checks message order and known sender identities. If you sent the latest non-draft message, it suppresses a stale reply flag. Optional sender aliases are used only for the current scan. The model receives account addresses and bounded thread text as untrusted data and returns constrained JSON: verdict, intended recipient and exact evidence. No model tools or email actions are available. A Reply flag requires an exact quote in the latest fresh body and a target of you or everyone. Fabricated quotes, other recipients, incomplete output and unsubscribe-only evidence are rejected or sent to Review. A matching quote is necessary, not proof that a classification is correct.

This is request detection, **not sender trust/phishing detection**. Newsletters, portal tasks and rhetorical questions are instructed to receive no reply flag, but actual precision/recall has not been measured. There are no calibrated confidence scores or claims that model probabilities predict acceptance.

## Privacy and permissions

Mail travels from Google to your browser and is processed by a shared local WebLLM worker in an offscreen extension document. OAuth tokens never go to the model. Tokens remain in Chrome Identity's cache and the API client's memory, not our extension storage or URLs. Gmail calls are GET-only; Disconnect separately POSTs the token to Google's official revocation endpoint. The worker resets conversation state around mail analyses.

Bodies and raw MIME are not saved. Dashboard results live in page memory. Badge quotes/IDs and the connected account live in trusted extension **session memory**, not persistent storage; they can survive service-worker suspension and are cleared on disconnect/browser-session end. Dismissal fingerprints (account/thread/latest-message hashes, without subjects or bodies) and a badge-enabled preference are saved locally. Hashes are metadata, not a guarantee of anonymity. There is no telemetry or developer service. See [privacy disclosure](docs/PRIVACY.md).

Gmail website permission is needed for the DOM badge; Chrome can describe that as read/change website data. The actual Gmail OAuth grant is read-only, and the badge code changes only its own visual elements. The model/worker has no Gmail OAuth token or email-write tools. **Disconnect & clear** clears local results, badge data, dismissals and Chrome's token cache; stops the observer; releases the model; and attempts Google revocation. The UI distinguishes failed/unconfirmed revocation.

## Implementation

Manifest V3, TypeScript, WebLLM 0.2.86, WebGPU, and a small inert MIME/HTML text parser. A single local model is shared with the earlier typing prototype; busy requests wait or are cancelled rather than initializing another model. Selected Qwen3.5 0.8B/2B/4B compiled libraries ship in the ZIP with tracked SHA-256 checks; model data is downloaded only after Load. Scripts/WASM execute locally under extension CSP. Only model-data and the required Google API/revocation hosts are permitted for extension fetches.

The Gmail adapter reads explicit visible account controls and legacy thread IDs (or supported decimal IDs); it never assumes `/u/0` matches the connected account. It inserts a fixed-width Reply badge in the existing subject cell, leaving Google's importance marker and table structure intact. It is a visual overlay, not a native Gmail column or server label. Unknown layouts/accounts receive no annotations. The adapter stops on disconnect and invalidates observed changing rows.

The previous typing experiment is retained under the popup's collapsed **Typing prototype / advanced** section; its built-in Try it page still needs no server. It supports ordinary text inputs/textareas, not contenteditable/Gmail composing. Mail scanning and typing share GPU resources, so pause other local inference for best scan latency.

## Build and verify

Use the existing checkout (no worktree needed). Requires Node 22+, npm, curl and zip.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run package
# Optional browser tests: leave npm run serve running in another terminal.
npm run test:browser
npm run test:mail-browser
```

On a Mac set `CHROME_PATH` for automated browser scripts. The tests use explicit identity/Gmail/model fixtures and a Gmail-like DOM; they validate application behavior, read-only requests, evidence checks, privacy boundaries and cleanup, **not live Gmail authorization or real-model accuracy**. Cloud Chromium blocks unpacked extensions and has no WebGPU adapter. Real Google OAuth, live Gmail layout compatibility and Mac model quality remain user-side validation steps. See [test evidence](docs/BENCHMARK.md) and [model report](docs/MODELS.md).

Google restricted-scope verification/public-distribution requirements remain unresolved. No app/store publication or external email action has been performed. The current code and ZIP are a personal prototype for testing.
