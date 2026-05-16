/**
 * Popup UI — 拡張機能設定の表示・保存。
 */

const fields = ['apiUrl', 'apiKey', 'slackWebhookUrl'];

document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.sync.get({
    apiUrl: 'http://localhost:8787',
    apiKey: '',
    trackByDefault: true,
    showOptoutFooter: false,
    slackWebhookUrl: '',
  });

  for (const field of fields) {
    document.getElementById(field).value = config[field] || '';
  }
  document.getElementById('trackByDefault').checked = config.trackByDefault;
  document.getElementById('showOptoutFooter').checked = config.showOptoutFooter;
});

document.getElementById('save').addEventListener('click', async () => {
  const config = {};
  for (const field of fields) {
    config[field] = document.getElementById(field).value.trim();
  }
  config.trackByDefault = document.getElementById('trackByDefault').checked;
  config.showOptoutFooter = document.getElementById('showOptoutFooter').checked;

  await chrome.storage.sync.set(config);

  const status = document.getElementById('status');
  status.textContent = 'Settings saved!';
  status.className = 'status status--ok';

  // API接続テスト
  if (config.apiUrl) {
    try {
      const headers = {};
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }
      const res = await fetch(`${config.apiUrl}/health`, { headers });
      if (res.ok) {
        status.textContent = 'Settings saved! API connected.';
      } else {
        status.textContent = `Settings saved. API returned ${res.status}.`;
        status.className = 'status status--err';
      }
    } catch (e) {
      status.textContent = `Settings saved. API unreachable: ${e.message}`;
      status.className = 'status status--err';
    }
  }

  setTimeout(() => { status.textContent = ''; }, 5000);
});
