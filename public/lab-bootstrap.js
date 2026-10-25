// The bundled lab works directly inside the extension, without a local server.
// HTTP copies rely on the normal allowlisted content script instead.
if (location.protocol === 'chrome-extension:') {
 const script = document.createElement('script');
 script.src = chrome.runtime.getURL('content.js');
 document.head.append(script);
}
