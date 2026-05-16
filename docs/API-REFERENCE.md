# API Reference

Base URL: `https://your-worker.workers.dev`

## Authentication

### Self-hosted mode (`HOSTING_MODE=self`)
No authentication required. All requests use the default `self` tenant.

### Hosted mode (`HOSTING_MODE=hosted`)
Two authentication methods:

1. **API Key** (Chrome extension): `Authorization: Bearer mt_xxx...`
2. **Cookie session** (Dashboard): Set via Better Auth sign-in

## Endpoints

### Health Check

```
GET /health
```

Response:
```json
{"status": "ok", "version": "0.3.0", "mode": "self"}
```

---

### Email Tracking

#### Register Email

```
POST /api/emails
Content-Type: application/json
```

Body:
```json
{
  "recipient": "user@example.com",
  "subject": "Meeting follow-up",
  "recipientName": "John",
  "gmailMessageId": "abc123",
  "threadId": "thread456",
  "tag": "sales",
  "urls": [
    {"url": "https://example.com/doc", "label": "Document"}
  ]
}
```

Response `201`:
```json
{
  "id": "email_cuid",
  "trackingId": "tracking_cuid",
  "pixelUrl": "https://api.example.com/pixel/tracking_cuid.gif",
  "optoutUrl": "https://api.example.com/optout/email_cuid",
  "optoutHtml": "<div>...<a href=\"...\">Unsubscribe from tracking</a></div>",
  "links": [
    {
      "originalUrl": "https://example.com/doc",
      "trackingUrl": "https://api.example.com/r/link_cuid",
      "label": "Document"
    }
  ]
}
```

Errors:
- `400` — Missing `recipient`
- `403` — Tenant not found or suspended
- `429` — Monthly email limit reached

#### List Emails

```
GET /api/emails?limit=50&offset=0
```

Response `200`:
```json
{
  "data": [
    {
      "id": "...",
      "trackingId": "...",
      "subject": "...",
      "recipient": "...",
      "sentAt": 1234567890,
      "openCount": 3,
      "clickCount": 1,
      "firstOpenedAt": 1234567900
    }
  ],
  "pagination": {"limit": 50, "offset": 0}
}
```

#### Get Email Detail

```
GET /api/emails/:id
```

Response includes `opens` timeline and `links` with click counts.

---

### Tracking Endpoints (No Auth)

#### Open Pixel

```
GET /pixel/:trackingId.gif
```

Returns 1x1 transparent GIF. Always returns `200` (even for unknown IDs).

#### Link Redirect

```
GET /r/:trackingId
```

Returns `302` redirect to original URL. Records click event.
Returns `404` for unknown tracking IDs.

---

### Opt-Out

#### API Opt-Out

```
POST /api/emails/:id/optout
Content-Type: application/json
```

Body: `{"reason": "Privacy"}` (optional)

#### Public Opt-Out Page (No Auth)

```
GET /optout/:emailId    → HTML page with opt-out button
POST /optout/:emailId   → Executes opt-out
```

---

### Account Management (Hosted Mode)

#### Usage

```
GET /api/account/usage
```

Response:
```json
{
  "plan": "free",
  "monthlyEmailLimit": 500,
  "monthlyEmailCount": 42,
  "resetAt": 1234567890
}
```

#### GDPR Data Export

```
GET /api/account/data
```

Returns all data associated with the authenticated tenant.

#### GDPR Data Deletion

```
DELETE /api/account/data
```

Deletes all tracking data. Account is soft-deleted (suspended).

---

### API Keys (Hosted Mode)

#### Create Key

```
POST /api/keys
Content-Type: application/json
```

Body: `{"name": "Chrome Extension"}` (optional)

Response `201`:
```json
{
  "key": "mt_xxxxxxxxxxxxx",
  "prefix": "mt_xxxx",
  "name": "Chrome Extension",
  "message": "Save this key — it will not be shown again."
}
```

#### List Keys

```
GET /api/keys
```

#### Revoke Key

```
DELETE /api/keys/:id
```

---

### Authentication (Hosted Mode)

Better Auth endpoints under `/api/auth/*`:

- `POST /api/auth/sign-up/email` — Email/password registration
- `POST /api/auth/sign-in/email` — Email/password login
- `POST /api/auth/sign-out` — Logout
- `GET /api/auth/sign-in/social?provider=google` — Google OAuth

---

### Static Pages (No Auth)

- `GET /privacy` — Privacy policy
- `GET /terms` — Terms of service
