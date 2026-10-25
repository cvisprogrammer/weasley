export const modelId = 'Qwen3.5-2B-q4f16_1-MLC';
export interface Settings { enabled: boolean; model: string; sites: string[]; delay: number; tokens: number; }
export const defaults: Settings = { enabled: true, model: modelId, sites: [], delay: 250, tokens: 10 };
export const settings = async (): Promise<Settings> => ({ ...defaults, ...((await chrome.storage.local.get('settings')).settings as Partial<Settings> || {}) });
export function allowed(url: string, s: Settings) { try { return s.enabled && s.sites.includes(new URL(url).origin); } catch { return false; } }
export function clean(text: string, prefix: string, limit = 80) {
  if (/[<>]|^(sure|here|of course|assistant|the continuation)\b/i.test(text.trim()) || /[\r\n]/.test(text)) return '';
  let value = text.replace(/["“”]/g, '').slice(0, limit);
  if (/\s$/.test(prefix)) value = value.trimStart();
  if (value.length === limit) value = value.replace(/\s+\S*$/, '');
  return value;
}
export function nextWord(text: string) { return text.match(/^\s*\S+\s*/)?.[0] || text; }
export function safeField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) return false;
  if (el instanceof HTMLInputElement && !['text', 'search'].includes(el.type)) return false;
  return !el.disabled && !el.readOnly && !el.closest('[data-private]') &&
    !/password|one-time|cc-|username|email|tel|address|name|birth|transaction|ssn|social.?security|credit.?card|card.?number|cvv|bank|routing|api.?key|secret|token|otp/i.test(el.autocomplete + ' ' + el.getAttribute('name') + ' ' + el.id + ' ' + el.getAttribute('aria-label'));
}

// Chrome host permissions cover a hostname; runtime consent still matches the exact origin/port.
export function matchPattern(origin: string) { const u=new URL(origin);return `${u.protocol}//${u.hostname}/*`; }
