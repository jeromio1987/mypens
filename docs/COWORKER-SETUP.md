# Coworker handoff — MY PENS (after Step 1: `npm run dev` works)

Use this doc so everyone knows **who does what**. Nothing here requires pasting secrets into chat.

---

## Who does what (summary)

| Task | **Owner (Jerom)** | **Coworker** |
|------|-------------------|--------------|
| Create / own Anthropic account & API key | Yes | No |
| Create / own Supabase project (if used) | Yes | No |
| Invent `MOBILE_PENS_API_TOKEN` (random string) | Yes (or tell coworker the value privately) | Can generate if owner asks |
| Edit **`mypens/.env`** on this PC | Owner **or** coworker at machine | |
| Edit **`mypens-mobile/.env`** on this PC | Owner **or** coworker at machine | |
| Run `npm run dev` from **`mypens`** root | Coworker (or owner) | |
| Run `npx expo start` from **`mypens-mobile`** | Coworker (or owner) | |
| Open Windows Firewall for port **5000** | Coworker at PC (needs admin) | |
| Test phone browser → `http://LAN-IP:5000` | Owner with phone on same Wi‑Fi | |

**Rule:** API keys and tokens **never** go in Slack/email screenshots. Hand off `.env` edits in person or via a password manager note.

---

## Coworker checklist (do in order)

### 1) Confirm Next is running from the correct folder

- Folder must contain `package.json`, `app/`, `prisma/`, `.env`.
- In that folder:

  ```powershell
  npm run dev
  ```

- If you see `Missing script: "dev"`, you are **not** in the project root — `cd` to the real `mypens` folder first.

### 2) Quick config check (no `.env` reading)

With the dev server running, open in a browser (on the same PC):

`http://localhost:5000/api/health`

You should see JSON like:

```json
{
  "ok": true,
  "server": "my-pens",
  "env": {
    "hasAnthropicKey": true,
    "hasMobileToken": true,
    "hasDatabaseUrl": true
  }
}
```

- **`hasAnthropicKey: false`** → owner must add `ANTHROPIC_API_KEY` to **`mypens/.env`** (from [Anthropic API keys](https://platform.claude.com/settings/keys)), then restart `npm run dev`.
- **`hasMobileToken: false`** → owner must add `MOBILE_PENS_API_TOKEN` to **`mypens/.env`**, then restart Next.
- **`hasDatabaseUrl: false`** → database URL missing; owner fixes Prisma env — separate from mobile.

### 3) Mobile bridge (Expo → API)

**Daily phone = Vercel.** Local Next `:5000` is for **code agents only**.

In **`mypens/.env`** (and **Vercel** env — must match):

```env
MOBILE_PENS_API_TOKEN=<same-long-secret-everywhere>
```

In **`mypens-mobile/.env`** (Expo — baked into APK at build time):

```env
EXPO_PUBLIC_PENS_API_URL=https://mypens.vercel.app
EXPO_PUBLIC_PENS_API_TOKEN=<same-as-MOBILE_PENS_API_TOKEN>
```

Rebuild the APK after any `EXPO_PUBLIC_*` change. Agents temporarily debugging against LAN may override URL to `http://<PC-LAN-IPv4>:5000` — do **not** leave that as the daily default.

### 4) Phone reaches production (no local Next)

On the phone browser: `https://mypens.vercel.app` — Food → Take photo works without `npm run dev`.

Agents-only LAN check: `http://<PC-LAN-IPv4>:5000` (firewall may block TCP 5000).

### 5) Expo

From **`mypens-mobile`**:

```powershell
npx expo start
```

Owner opens **Food** tab against **Vercel**: no “connect” banner, lists load, photo scan works if production `hasAnthropicKey` is true.

### 6) Supabase (only if owner still uses Supabase tabs on Expo)

Owner supplies URL + anon key from [Supabase dashboard](https://supabase.com/dashboard/projects) → **Project → Settings / Data API** (or **API**). Coworker pastes into **`mypens-mobile/.env`** as `EXPO_PUBLIC_SUPABASE_*`, restart Expo.

---

## Owner-only (cannot delegate account creation)

- Anthropic login + billing + API key: https://platform.claude.com/settings/keys  
- Supabase login + project: https://supabase.com/dashboard/projects  
- Deciding the final `MOBILE_PENS_API_TOKEN` value (if coworker generates it, owner must store it safely)

---

## Done criteria

- [ ] Production `https://mypens.vercel.app/api/health` shows all three `has*` flags the owner expects  
- [ ] Phone APK points at `https://mypens.vercel.app` (rebuild after `EXPO_PUBLIC_*` change)  
- [ ] Expo Food tab works against Vercel (no config banner; no local Next needed)  
- [ ] Optional: photo scan returns items (needs production `hasAnthropicKey: true`)
