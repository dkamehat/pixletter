import { Hono } from 'hono';
import type { Env } from '../lib/types';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /privacy
 * プライバシーポリシー（FR-P2-33）。
 * 認証不要。opt-out ページからリンクされる。
 */
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy Policy — mailtrack-pf</title>
<style>
body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#333;line-height:1.6;}
h1{font-size:1.5rem;} h2{font-size:1.2rem;margin-top:2rem;}
a{color:#2563eb;}
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p><strong>Last updated:</strong> May 2026</p>
<p>mailtrack-pf ("we", "us") is an open-source email tracking service. This policy explains what data we collect and how we handle it.</p>

<h2>1. What We Collect</h2>
<p>When a tracked email is opened or a link is clicked, we record:</p>
<ul>
<li><strong>Hashed IP address</strong> — a one-way SHA-256 hash; we cannot recover the original IP.</li>
<li><strong>User-Agent string</strong> — browser/email client identifier.</li>
<li><strong>Timestamp</strong> — when the event occurred.</li>
<li><strong>Gmail proxy detection</strong> — whether the request came through GoogleImageProxy.</li>
</ul>
<p>We do <strong>not</strong> collect names, physical addresses, or any personally identifiable information beyond the recipient's email address (provided by the sender).</p>

<h2>2. How Data Is Used</h2>
<p>Data is used solely to show the sender whether their email was opened and which links were clicked. We do not sell, share, or use this data for advertising.</p>

<h2>3. Data Storage</h2>
<p>Data is stored in Cloudflare D1 (SQLite), hosted on Cloudflare's global network. Data is encrypted at rest by Cloudflare.</p>

<h2>4. Opt-Out / Tracking Removal</h2>
<p>Email recipients can opt out of tracking at any time by clicking the "Unsubscribe from tracking" link in the email footer or visiting the opt-out page. Once opted out:</p>
<ul>
<li>No further open or click events will be recorded for your email address from that sender.</li>
<li>Existing data is retained for the sender's analytics but no new data is collected.</li>
</ul>

<h2>5. Data Deletion (GDPR)</h2>
<p>To request deletion of all data associated with your email address, contact the sender directly or email <strong>privacy@mailtrack-pf.dev</strong>.</p>

<h2>6. Self-Hosted Instances</h2>
<p>If you are using a self-hosted instance of mailtrack-pf, the operator of that instance is the data controller. This policy applies only to the official hosted service.</p>

<h2>7. Changes to This Policy</h2>
<p>We may update this policy from time to time. Changes will be posted on this page with an updated date.</p>

<h2>8. Contact</h2>
<p>For questions about this policy: <strong>privacy@mailtrack-pf.dev</strong></p>

<p style="margin-top:32px;font-size:12px;color:#999;"><a href="/">← Back to mailtrack-pf</a></p>
</body>
</html>`);
});

export default app;
