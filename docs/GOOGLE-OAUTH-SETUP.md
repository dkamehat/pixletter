# Google OAuth Setup Guide

## 1. Create a Project in Google Cloud Console

- Go to https://console.cloud.google.com
- Create a new project or select an existing one

## 2. Configure OAuth Consent Screen

- APIs & Services → OAuth consent screen
- User Type: **External**
- App name: `mailtrack-pf`
- User support email: your email address
- Authorized domains: your Workers domain (e.g., `kame-lift.workers.dev`)
- Scopes: `email`, `profile`, `openid`
- Test users: add your Gmail address (only test users can sign in before verification)

## 3. Create OAuth Client ID

- APIs & Services → Credentials → Create Credentials → OAuth Client ID
- Application type: **Web application**
- Name: `mailtrack-pf`
- Authorized JavaScript origins: `https://<your-api>.workers.dev`
- Authorized redirect URIs: `https://<your-api>.workers.dev/api/auth/callback/google`

## 4. Set Secrets in Cloudflare Workers

```bash
echo "<YOUR_CLIENT_ID>" | npx wrangler secret put GOOGLE_CLIENT_ID --config=apps/api/wrangler.toml
echo "<YOUR_CLIENT_SECRET>" | npx wrangler secret put GOOGLE_CLIENT_SECRET --config=apps/api/wrangler.toml
npx wrangler deploy --config=apps/api/wrangler.toml
```

## 5. Verify

Open in browser:
```
https://<your-api>.workers.dev/api/auth/sign-in/social?provider=google
```
→ If you are redirected to the Google login screen, the setup is complete.

## Notes

- Before verification, the app is in "Testing" status. Only test users added in the consent screen can sign in (max 100 users).
- Full production access requires Google's verification review (days to weeks).
- Email/password authentication works without Google verification.
