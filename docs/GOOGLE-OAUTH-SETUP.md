# Google OAuth 設定手順

## 1. Google Cloud Console でプロジェクト作成

- https://console.cloud.google.com
- 新規プロジェクト作成 or 既存プロジェクト選択

## 2. OAuth consent screen 設定

- APIs & Services → OAuth consent screen
- User Type: **External**
- App name: `mailtrack-pf`
- User support email: 自分のメール
- Authorized domains: `kame-lift.workers.dev`
- Scopes: `email`, `profile`, `openid`
- Test users: 自分のGmailアドレスを追加（審査前はテストユーザーのみ使用可能）

## 3. OAuth Client ID 作成

- APIs & Services → Credentials → Create Credentials → OAuth Client ID
- Application type: **Web application**
- Name: `mailtrack-pf`
- Authorized JavaScript origins: `https://mailtrack-pf-api.kame-lift.workers.dev`
- Authorized redirect URIs: `https://mailtrack-pf-api.kame-lift.workers.dev/api/auth/callback/google`

## 4. Cloudflare Workers にシークレット設定

```bash
echo "<YOUR_CLIENT_ID>" | npx wrangler secret put GOOGLE_CLIENT_ID --config=apps/api/wrangler.toml
echo "<YOUR_CLIENT_SECRET>" | npx wrangler secret put GOOGLE_CLIENT_SECRET --config=apps/api/wrangler.toml
npx wrangler deploy --config=apps/api/wrangler.toml
```

## 5. 動作確認

ブラウザでアクセス:
```
https://mailtrack-pf-api.kame-lift.workers.dev/api/auth/sign-in/social?provider=google
```
→ Google ログイン画面にリダイレクトされればOK

## 注意点

- 審査前は「Testing」ステータス。テストユーザーに追加した Google アカウントのみ使用可能（最大100人）
- 本番公開には Google の審査が必要（数日〜数週間）
- 審査なしでも email/password 認証は動作する
