import { Hono } from 'hono';
import type { Env } from '../lib/types';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /terms
 * 利用規約（FR-P2-33 + 特定電子メール法対応）。
 * 認証不要。
 */
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>利用規約 / Terms of Service — mailtrack-pf</title>
<style>
body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#333;line-height:1.6;}
h1{font-size:1.5rem;} h2{font-size:1.2rem;margin-top:2rem;}
a{color:#2563eb;}
</style>
</head>
<body>
<h1>利用規約 / Terms of Service</h1>
<p><strong>最終更新:</strong> 2026年5月</p>

<h2>1. サービス概要</h2>
<p>mailtrack-pf（以下「本サービス」）は、Gmail 送信メールの開封・クリック追跡機能を提供するオープンソースサービスです。</p>

<h2>2. 利用条件</h2>
<ul>
<li>本サービスを利用するには、18歳以上であること。</li>
<li>スパム送信、フィッシング、その他の違法目的での利用を禁止します。</li>
<li>受信者の opt-out（追跡停止）リクエストを尊重すること。</li>
</ul>

<h2>3. 特定電子メール法に関する表示</h2>
<p>本サービスの利用にあたり、ユーザーは以下の日本法を遵守する必要があります。</p>
<ul>
<li><strong>特定電子メールの送信の適正化等に関する法律</strong>（特定電子メール法）</li>
<li>受信者の同意なく広告・宣伝目的のメールを送信することは禁止されています。</li>
<li>送信するメールには、送信者の氏名・名称、連絡先、及び受信拒否の通知先を明記してください。</li>
</ul>

<h2>4. 送信者の義務</h2>
<p>本サービスを通じてメール追跡を行うユーザー（送信者）は、以下の義務を負います:</p>
<ul>
<li>トラッキングピクセルを含むメールを送信する際、受信者に追跡を行っていることを適切に開示すること。</li>
<li>受信者がオプトアウト（追跡停止）を希望した場合、速やかにこれを尊重すること。</li>
<li>本サービスが自動挿入する opt-out リンクを改変・削除しないこと。</li>
</ul>

<h2>5. 免責事項</h2>
<ul>
<li>本サービスは「現状のまま（AS IS）」で提供されます。</li>
<li>サービスの中断、データの損失について、運営者は責任を負いません。</li>
<li>無料プランの範囲内でサービスを提供しており、SLA は保証しません。</li>
</ul>

<h2>6. アカウント停止</h2>
<p>以下の場合、アカウントを自動的に停止します:</p>
<ul>
<li>受信者からの opt-out リクエストが 10 件を超えた場合（abuse 対策）。</li>
<li>スパム行為やその他の規約違反が検知された場合。</li>
</ul>

<h2>7. 準拠法</h2>
<p>本規約は日本法に準拠し、東京地方裁判所を第一審の専属管轄裁判所とします。</p>

<h2>8. 連絡先</h2>
<p>Operator: kame_lift (@kame__lift)<br>
Email: <strong>support@mailtrack-pf.dev</strong></p>

<p style="margin-top:32px;font-size:12px;color:#999;">
<a href="/privacy">Privacy Policy</a> · <a href="/">Home</a></p>
</body>
</html>`);
});

export default app;
