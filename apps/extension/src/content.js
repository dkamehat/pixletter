/**
 * Content Script — Gmail に注入され、Compose 画面にトラッキング機能を追加する。
 *
 * FR-EXT-01: Track トグルボタン表示
 * FR-EXT-02: 送信時に API POST → tracking 情報取得
 * FR-EXT-03: メール本文末尾に 1×1 透明 GIF 挿入
 * FR-EXT-04: 本文内 URL をトラッキング URL に書き換え
 */

// ============================================================
// State
// ============================================================
const injectedSendBtns = new WeakSet();

// ============================================================
// Gmail Compose Detection — ポーリング方式
// Compose の送信ボタン (.aoO) を直接探し、未注入ならトグルを追加する。
// MutationObserver だけでは Gmail の動的 DOM 生成を確実に捕捉できないため、
// ポーリングを併用する。
// ============================================================
function init() {
  // 1秒ごとに送信ボタンをスキャン
  setInterval(scanForCompose, 1000);
  // 初回即実行
  scanForCompose();
}

function scanForCompose() {
  // Gmail の送信ボタンを全て探す（複数 Compose window 対応）
  var sendBtns = document.querySelectorAll('.T-I.J-J5-Ji.aoO[role="button"]');
  for (var i = 0; i < sendBtns.length; i++) {
    var btn = sendBtns[i];
    if (injectedSendBtns.has(btn)) continue;
    injectedSendBtns.add(btn);
    injectToggle(btn);
  }
}

// ============================================================
// Toggle Button — FR-EXT-01
// ============================================================
function injectToggle(sendBtn) {
  var toolbar = sendBtn.parentElement;
  if (!toolbar) return;

  var state = { tracking: true };

  // 設定から初期値を取得
  try {
    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, function(config) {
      if (config && typeof config.trackByDefault === 'boolean') {
        state.tracking = config.trackByDefault;
        updateToggleUI(toggle, state);
      }
    });
  } catch (e) {
    // Extension context invalidated — ignore
  }

  var toggle = document.createElement('span');
  toggle.className = 'mt-track-toggle mt-track-toggle--on';
  toggle.setAttribute('style',
    'display:inline-flex;align-items:center;gap:6px;padding:4px 12px;' +
    'margin-left:8px;border-radius:16px;font-size:12px;cursor:pointer;' +
    'user-select:none;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;' +
    'font-family:Google Sans,Roboto,sans-serif;'
  );
  toggle.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#4caf50;display:inline-block;"></span>' +
    '<span class="mt-track-label">Track ON</span>';
  toggle.title = 'Toggle email tracking';

  toggle.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    state.tracking = !state.tracking;
    updateToggleUI(toggle, state);
  });

  toolbar.appendChild(toggle);

  // Intercept send
  interceptSend(sendBtn, state);
}

function updateToggleUI(toggle, state) {
  if (state.tracking) {
    toggle.setAttribute('style',
      'display:inline-flex;align-items:center;gap:6px;padding:4px 12px;' +
      'margin-left:8px;border-radius:16px;font-size:12px;cursor:pointer;' +
      'user-select:none;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;' +
      'font-family:Google Sans,Roboto,sans-serif;'
    );
    toggle.querySelector('.mt-track-label').textContent = 'Track ON';
    toggle.querySelector('span').style.background = '#4caf50';
  } else {
    toggle.setAttribute('style',
      'display:inline-flex;align-items:center;gap:6px;padding:4px 12px;' +
      'margin-left:8px;border-radius:16px;font-size:12px;cursor:pointer;' +
      'user-select:none;background:#f5f5f5;color:#9e9e9e;border:1px solid #e0e0e0;' +
      'font-family:Google Sans,Roboto,sans-serif;'
    );
    toggle.querySelector('.mt-track-label').textContent = 'Track OFF';
    toggle.querySelector('span').style.background = '#bdbdbd';
  }
}

// ============================================================
// Send Interception — FR-EXT-02, 03, 04
// ============================================================
function interceptSend(sendBtn, state) {
  sendBtn.addEventListener(
    'click',
    async function(e) {
      if (!state.tracking) return; // tracking off, send normally

      e.stopImmediatePropagation();
      e.preventDefault();

      // Find compose container
      var composeEl = sendBtn.closest('.nH.Hd') || sendBtn.closest('[role="dialog"]') || sendBtn.closest('.AD');

      try {
        var payload = extractEmailData(composeEl);
        var result = await sendToApi(payload);
        var config = await new Promise(function(resolve) {
          chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, resolve);
        });

        if (result && !result.error) {
          injectPixel(composeEl, result.pixelUrl);
          rewriteLinks(composeEl, result.links || []);
          // opt-out フッター挿入
          // FR-P3-10: hosted版では forceOptoutFooter=true で強制挿入
          // self版では設定 (showOptoutFooter) に従う
          if (result.optoutHtml && (result.forceOptoutFooter || (config && config.showOptoutFooter))) {
            injectOptoutFooter(composeEl, result.optoutHtml);
          }
        }
      } catch (err) {
        console.error('[pixletter] Failed to track:', err);
      }

      // Re-click send (tracking off to avoid loop)
      state.tracking = false;
      sendBtn.click();
    },
    { capture: true, once: true },
  );
}

/**
 * Compose ウィンドウからメールメタデータを抽出する。
 */
function extractEmailData(composeEl) {
  if (!composeEl) return { subject: '', recipient: 'support@example.com' };

  var subjectEl = composeEl.querySelector('input[name="subjectbox"]');
  var subject = subjectEl ? subjectEl.value : '';

  // To field
  var toEls = composeEl.querySelectorAll('[name="to"], [data-hovercard-id]');
  var recipients = [];
  for (var i = 0; i < toEls.length; i++) {
    var el = toEls[i];
    var email = el.getAttribute('data-hovercard-id') || el.value || el.textContent;
    if (email && email.indexOf('@') !== -1) {
      recipients.push(email.trim());
    }
  }
  var recipient = recipients[0] || 'support@example.com';

  // Body URLs
  var bodyEl = composeEl.querySelector('[role="textbox"][contenteditable="true"]');
  var urls = [];
  if (bodyEl) {
    var anchors = bodyEl.querySelectorAll('a[href]');
    for (var j = 0; j < anchors.length; j++) {
      var href = anchors[j].getAttribute('href');
      if (href && href.indexOf('http') === 0 && href.indexOf('mailto:') === -1) {
        urls.push({ url: href, label: anchors[j].textContent || undefined });
      }
    }
  }

  return {
    subject: subject,
    recipient: recipient,
    recipientName: recipients[0] ? recipients[0].split('@')[0] : undefined,
    urls: urls.length > 0 ? urls : undefined,
  };
}

/**
 * Background Script (Service Worker) 経由で API に送信する。
 */
function sendToApi(payload) {
  return new Promise(function(resolve) {
    chrome.runtime.sendMessage({ type: 'TRACK_EMAIL', payload: payload }, function(response) {
      resolve(response);
    });
  });
}

/**
 * メール本文末尾に 1x1 透明 GIF を挿入する — FR-EXT-03
 */
function injectPixel(composeEl, pixelUrl) {
  if (!composeEl || !pixelUrl) return;
  var bodyEl = composeEl.querySelector('[role="textbox"][contenteditable="true"]');
  if (!bodyEl) return;

  var pixel = document.createElement('img');
  pixel.src = pixelUrl;
  pixel.width = 1;
  pixel.height = 1;
  pixel.setAttribute('style', 'display:block;width:1px;height:1px;overflow:hidden;opacity:0;');
  pixel.alt = '';
  bodyEl.appendChild(pixel);
}

/**
 * 本文内の URL をトラッキング用リダイレクタ URL に書き換える — FR-EXT-04
 */
function rewriteLinks(composeEl, trackedLinks) {
  if (!composeEl || trackedLinks.length === 0) return;
  var bodyEl = composeEl.querySelector('[role="textbox"][contenteditable="true"]');
  if (!bodyEl) return;

  var urlMap = {};
  for (var i = 0; i < trackedLinks.length; i++) {
    urlMap[trackedLinks[i].originalUrl] = trackedLinks[i].trackingUrl;
  }

  var anchors = bodyEl.querySelectorAll('a[href]');
  for (var j = 0; j < anchors.length; j++) {
    var href = anchors[j].getAttribute('href');
    if (urlMap[href]) {
      anchors[j].setAttribute('href', urlMap[href]);
    }
  }
}

/**
 * opt-out フッターを挿入する — FR-P2-30
 */
function injectOptoutFooter(composeEl, html) {
  if (!composeEl) return;
  var bodyEl = composeEl.querySelector('[role="textbox"][contenteditable="true"]');
  if (!bodyEl) return;
  var div = document.createElement('div');
  div.innerHTML = html;
  bodyEl.appendChild(div);
}

// ============================================================
// Sent Folder Status Icons — FR-EXT-05
// ============================================================
function initSentFolderIcons() {
  var checkSentFolder = function() {
    return location.hash.indexOf('#sent') !== -1 || location.hash.indexOf('#label/Sent') !== -1;
  };

  setInterval(function() {
    if (checkSentFolder()) injectStatusIcons();
  }, 3000);
}

async function injectStatusIcons() {
  var rows = document.querySelectorAll('tr.zA');
  if (rows.length === 0) return;

  var stored = await chrome.storage.local.get('trackedEmails');
  var trackedEmails = stored.trackedEmails || {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row.querySelector('.mt-status')) continue;

    var subjectEl = row.querySelector('.bog .bqe, .bog span[data-thread-id]');
    var subject = subjectEl ? subjectEl.textContent.trim() : '';
    if (!subject) continue;

    var tracked = null;
    var keys = Object.keys(trackedEmails);
    for (var j = 0; j < keys.length; j++) {
      if (trackedEmails[keys[j]].subject === subject) {
        tracked = trackedEmails[keys[j]];
        break;
      }
    }
    if (!tracked) continue;

    var statusEl = document.createElement('span');
    statusEl.setAttribute('style', 'display:inline-block;margin-left:4px;font-size:11px;vertical-align:middle;');
    if (tracked.opened) {
      statusEl.setAttribute('style', statusEl.getAttribute('style') + 'color:#4caf50;');
      statusEl.textContent = '\u2713\u2713';
      statusEl.title = 'Opened ' + (tracked.openCount || 1) + ' time(s)';
    } else {
      statusEl.setAttribute('style', statusEl.getAttribute('style') + 'color:#9e9e9e;');
      statusEl.textContent = '\u2713';
      statusEl.title = 'Sent, not yet opened';
    }
    statusEl.className = 'mt-status';

    var target = row.querySelector('.bog') || row.querySelector('.xT');
    if (target) target.appendChild(statusEl);
  }
}

async function refreshTrackingStatus() {
  try {
    var config = await new Promise(function(resolve) {
      chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, resolve);
    });
    if (!config || !config.apiUrl) return;

    var headers = {};
    if (config.apiKey) headers['Authorization'] = 'Bearer ' + config.apiKey;

    var res = await fetch(config.apiUrl + '/api/emails?limit=50', { headers: headers });
    if (!res.ok) return;

    var body = await res.json();
    var trackedEmails = {};

    for (var i = 0; i < body.data.length; i++) {
      var email = body.data[i];
      trackedEmails[email.id] = {
        subject: email.subject,
        recipient: email.recipient,
        opened: (email.openCount || 0) > 0,
        openCount: email.openCount || 0,
        trackingId: email.trackingId,
      };
    }

    await chrome.storage.local.set({ trackedEmails: trackedEmails });
  } catch (err) {
    console.error('[pixletter] Failed to refresh tracking status:', err);
  }
}

// ============================================================
// Init
// ============================================================
init();
initSentFolderIcons();
refreshTrackingStatus();
setInterval(refreshTrackingStatus, 60000);
