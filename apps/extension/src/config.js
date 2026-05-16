/**
 * 拡張機能の設定管理。
 * chrome.storage.sync に保存し、ポップアップから変更可能。
 */

const DEFAULT_CONFIG = {
  apiUrl: 'http://localhost:8787',
  apiKey: '',
  trackByDefault: true,
  showOptoutFooter: false,
  slackWebhookUrl: '',
};

export async function getConfig() {
  const result = await chrome.storage.sync.get(DEFAULT_CONFIG);
  return /** @type {typeof DEFAULT_CONFIG} */ (result);
}

export async function setConfig(config) {
  await chrome.storage.sync.set(config);
}
