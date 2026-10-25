# Connect Gmail for the personal prototype

Version 0.4 includes the full connection helper, but deliberately ships **without a made-up or shared OAuth client ID**. Connecting real email requires a Google Cloud project and an OAuth client registered for your installed extension ID. A ChatGPT connector cannot provide credentials or authorization to this separate extension.

## One-time setup

1. Replace the contents of your existing extension folder with the v0.4 ZIP contents. Reload in `chrome://extensions`. Keep using the same folder: an unpacked extension's identity can change when its path changes, which also changes its OAuth registration and model-cache origin.
2. Open Weasley → **Open Needs your reply**. The page displays your actual extension ID and the setup steps. You can use **Try sample inbox** with a loaded model before configuring Google; its emails are fictional but are classified locally.
3. Open [Google Cloud Console](https://console.cloud.google.com/). Create or select your own project. Enable the [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com).
4. Configure Google Auth Platform / the OAuth consent screen (console naming can vary). Supply the required application and contact details. For a personal external prototype, leave publishing status **Testing** and add your Gmail account as a **test user**. Add the data-access scope `https://www.googleapis.com/auth/gmail.readonly`.
5. Create an OAuth client with application type **Chrome Extension**, not Web application or Desktop. Set its Application ID to the extension ID displayed by Weasley. This flow uses Chrome Identity and **does not use a client secret or manually configured redirect URI**.
6. Copy the public client ID ending in `.apps.googleusercontent.com` into the local setup helper. Click **Download configured manifest**. The helper preserves the current manifest and adds only the public `oauth2.client_id` and read-only scope.
7. Replace `manifest.json` in the same installed extension folder with that downloaded file. Ensure the filename is exactly `manifest.json` (not `manifest (1).json`). Reload the extension in `chrome://extensions` and reopen the reply inbox.
8. Choose/load a local model (Balanced 2B is the initial recommendation). Click **Connect Gmail · read only**, grant the optional network/website permissions and Google's consent, and verify the displayed account address. Chrome Identity chooses an account from the Chrome profile; the connected profile is shown before any thread bodies are read.
9. Click **Scan Primary inbox**. It fetches up to 20 Primary inbox threads and analyzes bounded text locally. It does not mark messages read. Open Gmail to see separate **↩ Reply** markers beside supported subject rows. Hover a badge for the supporting quote. Google's Important marker and Gmail labels are unchanged.

No email bodies are fetched before the explicit scan. A profile request is made on Connect to verify the account. Tokens stay in Chrome Identity's cache and the connection object's memory; they are never placed in extension storage, URLs, model requests or logs. The only token-bearing outbound requests are Gmail authorization headers and the official Google revocation endpoint on Disconnect.

## Why the permissions look different

`gmail.readonly` is a **restricted Google OAuth scope**. It authorizes reading mail, not sending, deleting, archiving, marking read or editing labels. There is no narrower Gmail scope for reading only the Primary inbox; our application limits its query to that category and 20 threads per scan.

The extension also requests host access to `gmail.googleapis.com` for reads, `oauth2.googleapis.com` for revocation, and `mail.google.com` to render the Reply indicator. Chrome may describe website host access as permission to “read and change” site data: adding a visual badge requires DOM access. Our Gmail content script reads account controls and row identifiers and inserts/removes its own badge; it does not trigger Gmail actions. Google’s OAuth scope remains read-only. The code is inspectable and there is no developer backend.

## If sign-in or badges fail

- Confirm the OAuth client type is Chrome Extension, the Application ID exactly matches the installed extension, the Gmail API is enabled, and your account is an allowed test user.
- Use Google Chrome and check the connected account shown before scanning. Managed Google Workspace policies can block third-party access; resolve those with your administrator rather than supplying passwords or tokens.
- Testing-mode authorizations/tokens can expire according to Google's rules. Reconnect as needed. Never paste a token, password or client secret into chat or into the helper.
- Reload Gmail after enabling badges if an already-open tab does not show them. Only API-matched thread IDs on the matching visible Google account are annotated. Unknown layouts or account controls produce no badge; the local reply inbox remains usable.
- Badges represent the last scan, expire from view after 15 minutes, and are removed after observed row changes. Scan again after replying or receiving new activity. Unscanned/no-badge threads are **unknown**, not certified as clear.
- **Stop** cancels additional fetching/analysis. **Disconnect & clear** removes local results, session badge quotes and persistent dismissal fingerprints, stops the Gmail observer, releases the model, clears Chrome's local OAuth cache and attempts Google's token revocation. If revocation cannot be confirmed, remove the app from [Google account connections](https://myaccount.google.com/connections).

## Distribution status

A public release needs a stable extension identity/Chrome Web Store registration, an OAuth client registered for that identity, privacy/support disclosures and review of Google's current restricted-scope verification requirements. Local processing is not an automatic exemption. Official documentation was not readable from this cloud machine's network policy; follow current guidance in the Google console and [Gmail scope documentation](https://developers.google.com/workspace/gmail/api/auth/scopes). No public OAuth verification, live account connection, store submission or real-email scan has been completed here.
