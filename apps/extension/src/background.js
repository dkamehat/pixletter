/**
 * Service Worker (Manifest V3) — FR-EXT-07
 *
 * Content Script からのメッセージを受信し、API に POST する。
 * レスポンスの pixelUrl / links を Content Script に返却する。
 */

import { getConfig } from './config.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRACK_EMAIL') {
    handleTrackEmail(message.payload)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // 非同期応答
  }

  if (message.type === 'GET_CONFIG') {
    getConfig().then(sendResponse);
    return true;
  }
});

/**
 * API に POST /api/emails を送信し、tracking 情報を返却する（FR-EXT-02）。
 */
async function handleTrackEmail(payload) {
  const config = await getConfig();

  if (!config.apiUrl) {
    throw new Error('API URL is not configured. Open extension settings.');
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(`${config.apiUrl}/api/emails`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${response.status}`);
  }

  return response.json();
}
