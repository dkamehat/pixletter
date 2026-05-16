/**
 * FR-P2-23: Telemetry（デフォルト OFF）。
 * OSS版のデプロイ数を匿名で把握するためのオプトイン ping。
 *
 * 送信内容: { event: "deploy", version, mode, d1Tables }
 * 個人情報は一切含まない。
 *
 * 有効化: wrangler.toml の [vars] に TELEMETRY_ENABLED = "true" を追加。
 */

const TELEMETRY_ENDPOINT = 'https://mailtrack-pf-api.kame-lift.workers.dev/api/telemetry';

export async function sendTelemetryPing(env: {
  HOSTING_MODE?: string;
  TELEMETRY_ENABLED?: string;
}): Promise<void> {
  if (env.TELEMETRY_ENABLED !== 'true') return;

  try {
    await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'ping',
        version: '0.3.0',
        mode: env.HOSTING_MODE || 'self',
        ts: Date.now(),
      }),
    });
  } catch {
    // Telemetry failure is silently ignored
  }
}
