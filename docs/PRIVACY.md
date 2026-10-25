# Weasley privacy disclosure (draft for distribution review)

Weasley processes supported text fields only on websites the user explicitly allows, plus its own bundled test page. It automatically extracts a bounded sample of relevant rendered text from the same page: nearby passages and the main content area, ranked by proximity and overlap with the current draft. Model context is limited to 1,200 characters plus the current field prefix. It does not fetch other pages/tabs or read other form values.

Controls, editable regions, navigation, private markers, hidden/transparent content and extension UI are excluded by DOM rules. This is not semantic sensitive-data detection: a visible passage on an allowed website may contain private information and may be included as local context. The popup's Advanced section exposes the current excerpt. Disable or remove a website to stop processing it.

Inference runs in a local WebGPU worker. Typed text and harvested context are not uploaded, logged or saved to disk by Weasley. Context lives in memory and can be used only for the current request/page; conversation state is reset between predictions. Model data downloads from Hugging Face after explicit user load approval. Those requests expose normal connection metadata such as IP address but contain no typed/page text.

Settings, allowed origins, model cache and up to 500 numeric performance events are stored locally. There are no accounts, analytics, advertising or cloud inference services. Remove website permissions or clear numeric counters through the popup; uninstalling removes extension-local settings/data subject to Chrome's cache management. The version 0.3 simple test page no longer stores trial results. Older HTTP lab trial data, if any, can be removed by clearing that site's local storage.

Host websites retain their normal access to their own fields. Publisher identity, support contact, public policy URL and distribution-specific disclosures must be completed before store submission.
