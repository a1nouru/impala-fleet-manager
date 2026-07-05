# Mobile App (Installable PWA + Push) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Impala and Royal Express fleet-manager web apps into installable, home-screen mobile apps (PWA) that deliver real OS push notifications on Android and iOS, shared by a link with no app store.

**Architecture:** Add a PWA layer (manifest, icons, service worker, install UX) to each existing Next.js 15 app, plus a Web Push layer (VAPID, per-device subscription storage in Supabase, a server-side sender) hooked into the existing `notifications/trigger` broadcast pipeline. No native wrapper. The mobile app loads the already-hosted URL.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (`@supabase/ssr` + service-role admin client), Tailwind v4, `web-push` (new), `sharp` (new, dev-only, icon generation).

## Global Constraints

- Implement in BOTH repos: `impala-fleet-manager` (reference) and `royalexpress-fleet-manager` (port). Repos are near-identical mirrors — apply every change to both. Task 13 is the port.
- Reference repo for Tasks 1–12 is `impala-fleet-manager`. All paths below are relative to that repo unless noted.
- App directory is `app/` at repo root (NOT `src/app`). Public dir is `public/`.
- Service worker MUST NOT cache authenticated pages or API responses. Cache only static assets + the offline fallback. This preserves existing no-cache headers on `/api`, `/admin`, `/dashboard`, `/profile`.
- Push recipient rule for v1 = **all subscribed devices** (broadcast parity with WhatsApp). No per-user/role targeting.
- iOS push requires the app to be installed to the home screen first. Never request notification permission on iOS unless `display-mode: standalone`.
- VAPID public key is exposed to the browser as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; private key stays server-only as `VAPID_PRIVATE_KEY`; `VAPID_SUBJECT` is a `mailto:` string.
- Supabase clients: browser via `@/lib/supabase/client` (`createClient()`), server via `@/lib/supabase/server` (`createClient()`), service-role admin via `@/lib/supabase/admin` (new, Task 6).
- Current user client-side comes from `useAuth()` in `@/context/AuthContext` → `{ user }`, where `user.id` and `user.email` exist.
- Toasts: `import { useToast } from "@/components/ui/use-toast"`. Buttons: `import { Button } from "@/components/ui/button"`.
- The repo has no test runner. The one automated unit test in this plan runs via `npx tsx --test` (no install needed). Everything else is verified by `npm run build`, `curl` against `npm run dev`, Lighthouse, and real-device checks — matching how this codebase is validated.
- Commit after every task with the exact message shown.

---

### Task 1: App icons + generation script

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create (generated): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `public/icons/apple-touch-icon-180.png`
- Modify: `package.json` (add `sharp` devDependency + `icons` script)
- Source art: `public/logo.svg` (existing — Impala keeps its current art)

**Interfaces:**
- Produces: PNG icon files at the exact paths above, consumed by Task 2 (manifest) and Task 3 (Apple meta).

- [ ] **Step 1: Add sharp and an icons script to package.json**

Run:
```bash
npm install --save-dev sharp
```

Add to the `"scripts"` block in `package.json`:
```json
"icons": "node scripts/generate-icons.mjs"
```

- [ ] **Step 2: Write the icon generator**

Create `scripts/generate-icons.mjs`:
```js
// Rasterizes a source SVG into the PWA/Apple icon set.
// Usage: node scripts/generate-icons.mjs [sourceSvg] [maskableBgColor]
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = process.argv[2] || 'public/logo.svg';
const maskableBg = process.argv[3] || '#ffffff';
const outDir = 'public/icons';

async function main() {
  await mkdir(outDir, { recursive: true });
  const svg = readFileSync(source);

  // Standard "any" icons: logo edge-to-edge.
  await sharp(svg).resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(outDir, 'icon-192.png'));
  await sharp(svg).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(outDir, 'icon-512.png'));

  // Apple touch icon: opaque background (iOS ignores transparency oddly).
  await sharp(svg).resize(180, 180, { fit: 'contain', background: maskableBg })
    .flatten({ background: maskableBg })
    .png().toFile(path.join(outDir, 'apple-touch-icon-180.png'));

  // Maskable icon: logo in the safe zone (~80%) on a solid background.
  const inner = 512 * 0.8;
  const logo = await sharp(svg).resize(Math.round(inner), Math.round(inner), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: maskableBg } })
    .composite([{ input: logo, gravity: 'center' }])
    .png().toFile(path.join(outDir, 'icon-maskable-512.png'));

  console.log('✅ Icons generated in', outDir);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Generate the icons**

Run:
```bash
npm run icons
```
Expected: `✅ Icons generated in public/icons` and four PNG files created.

- [ ] **Step 4: Verify the files exist and are valid PNGs**

Run:
```bash
ls -la public/icons && file public/icons/icon-512.png
```
Expected: four files listed; `icon-512.png` reported as `PNG image data, 512 x 512`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json scripts/generate-icons.mjs public/icons
git commit -m "feat(pwa): add app icon set and generator"
```

---

### Task 2: Web app manifest

**Files:**
- Create: `app/manifest.ts`

**Interfaces:**
- Consumes: icon paths from Task 1.
- Produces: `/manifest.webmanifest` served by Next.js; referenced automatically in `<head>`.

- [ ] **Step 1: Write the manifest route**

Create `app/manifest.ts`:
```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Impala Express Fleet Manager',
    short_name: 'Impala Fleet',
    description: 'Manage bus fleet, maintenance, expenses, and inventory.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

- [ ] **Step 2: Build and confirm the manifest is emitted**

Run:
```bash
npm run build 2>&1 | grep -iE "manifest|error" | head
```
Expected: build completes; no errors referencing manifest.

- [ ] **Step 3: Verify the manifest at runtime**

Run (in one terminal `npm run dev`, then):
```bash
curl -s http://localhost:3000/manifest.webmanifest | head -c 400
```
Expected: JSON containing `"display":"standalone"` and the three icon entries.

- [ ] **Step 4: Commit**

```bash
git add app/manifest.ts
git commit -m "feat(pwa): add web app manifest"
```

---

### Task 3: Viewport + Apple meta tags in root layout

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `apple-touch-icon-180.png` from Task 1.
- Produces: `viewport` export with `themeColor` + safe-area; Apple standalone meta tags in `<head>`.

- [ ] **Step 1: Add a viewport export and Apple metadata**

In `app/layout.tsx`, add `Viewport` to the type import and export a `viewport`, and extend `metadata`. Replace the existing `metadata` block and add below it:
```ts
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Impala Express - Fleet Management System (Internal)",
  description: "Internal tool for managing bus fleet, tracking maintenance, and monitoring spare parts inventory.",
  applicationName: "Impala Fleet",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Impala Fleet",
  },
  icons: {
    icon: [{ url: '/favicon.svg', href: '/favicon.svg' }],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
```

- [ ] **Step 2: Build to confirm no type errors**

Run:
```bash
npm run build 2>&1 | tail -5
```
Expected: build completes successfully.

- [ ] **Step 3: Verify Apple meta at runtime**

Run (with `npm run dev` running):
```bash
curl -s http://localhost:3000/dashboard | grep -oiE 'apple-mobile-web-app-(capable|title)|theme-color' | sort -u
```
Expected: `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `theme-color` present.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(pwa): add viewport, theme-color, and Apple standalone meta"
```

---

### Task 4: Service worker (offline shell) + registration + offline page

**Files:**
- Create: `public/sw.js`
- Create: `public/offline.html`
- Create: `components/ServiceWorkerRegister.tsx`
- Modify: `app/layout.tsx` (mount `<ServiceWorkerRegister />`)

**Interfaces:**
- Produces: a registered service worker at `/sw.js`. Task 8 EXTENDS this same file with push handlers — keep the structure so push handlers append cleanly.

- [ ] **Step 1: Write the service worker (caching + offline only)**

Create `public/sw.js`:
```js
// Impala Fleet service worker. Caching is intentionally minimal:
// static assets only + an offline fallback. Authenticated pages/APIs are NEVER cached.
const CACHE = 'impala-pwa-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for our static assets only.
  if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Navigations: network-first, fall back to the offline page when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // Everything else (API, data): straight to network, no caching.
});
```

- [ ] **Step 2: Write the offline fallback page**

Create `public/offline.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Offline — Impala Fleet</title>
  <style>
    body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; padding: 1.5rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    p { color: #475569; max-width: 22rem; }
    button { margin-top: 1rem; padding: .6rem 1.2rem; border: 0; border-radius: .5rem; background: #2563eb; color: #fff; font-size: 1rem; }
  </style>
</head>
<body>
  <div>
    <h1>You're offline</h1>
    <p>Impala Fleet needs an internet connection. Reconnect and try again.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>
```

- [ ] **Step 3: Write the registration component**

Create `components/ServiceWorkerRegister.tsx`:
```tsx
"use client";
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed:", err);
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
```

- [ ] **Step 4: Mount it in the layout**

In `app/layout.tsx`, import and render inside `<body>` (after `<DebugEnvironment />`):
```tsx
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
// ...
        <DebugEnvironment />
        <ServiceWorkerRegister />
```

- [ ] **Step 5: Build, then verify SW + offline page are served**

Run (with `npm run dev` running):
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/sw.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/offline.html
```
Expected: `200` for both.

- [ ] **Step 6: Commit**

```bash
git add public/sw.js public/offline.html components/ServiceWorkerRegister.tsx app/layout.tsx
git commit -m "feat(pwa): add service worker, offline page, and registration"
```

---

### Task 5: Push subscriptions table (Supabase migration)

**Files:**
- Create: `supabase/migrations/20260705000001_create_push_subscriptions.sql`

**Interfaces:**
- Produces: table `push_subscriptions(id, user_id, endpoint, p256dh, auth, user_agent, created_at)` with RLS. Consumed by Tasks 6 (subscribe route) and 7 (sender).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260705000001_create_push_subscriptions.sql`:
```sql
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- A user manages only their own subscriptions.
create policy "own subscriptions - select" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "own subscriptions - insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "own subscriptions - delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Server sender uses the service-role key, which bypasses RLS.
```

- [ ] **Step 2: Apply the migration to the Impala Supabase project**

Apply via the Supabase SQL editor (paste the file contents) OR the project's existing migration flow. See `SUPABASE_MIGRATION_GUIDE.md`.
Note: per project memory, verify the Supabase CLI link points at the real DB before any `supabase db push` (the Impala CLI link has been stale).

- [ ] **Step 3: Verify the table exists**

In the Supabase SQL editor run:
```sql
select column_name from information_schema.columns where table_name = 'push_subscriptions' order by ordinal_position;
```
Expected: `id, user_id, endpoint, p256dh, auth, user_agent, created_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260705000001_create_push_subscriptions.sql
git commit -m "feat(push): add push_subscriptions table migration"
```

---

### Task 6: VAPID config, admin client, and subscribe/unsubscribe API

**Files:**
- Create: `lib/supabase/admin.ts`
- Create: `lib/push/vapid.ts`
- Create: `app/api/push/subscribe/route.ts`
- Modify: `package.json` (add `web-push` + `@types/web-push`)
- Modify: `scripts/check-env.js` (require VAPID vars)
- Modify: `.env.local` (add VAPID keys — local only, not committed)

**Interfaces:**
- Consumes: `push_subscriptions` table (Task 5).
- Produces:
  - `createAdminClient(): SupabaseClient` from `@/lib/supabase/admin`.
  - `getVapid(): { publicKey: string; privateKey: string; subject: string }` from `@/lib/push/vapid`.
  - `POST /api/push/subscribe` body `{ subscription: PushSubscriptionJSON }` → `{ ok: true }`.
  - `DELETE /api/push/subscribe` body `{ endpoint: string }` → `{ ok: true }`.

- [ ] **Step 1: Install web-push**

Run:
```bash
npm install web-push && npm install --save-dev @types/web-push
```

- [ ] **Step 2: Generate VAPID keys and add them to .env.local**

Run:
```bash
npx web-push generate-vapid-keys --json
```
Copy the output into `.env.local` (create these keys ONCE per repo; the public key must start with `NEXT_PUBLIC_`):
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey from output>
VAPID_PRIVATE_KEY=<privateKey from output>
VAPID_SUBJECT=mailto:admin@impala.example
```

- [ ] **Step 3: Add VAPID vars to the env checker**

In `scripts/check-env.js`, extend `requiredVars`:
```js
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT'
];
```

- [ ] **Step 4: Write the service-role admin client**

Create `lib/supabase/admin.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

// Server-only. Uses the service-role key; bypasses RLS. Never import from client code.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 5: Write the VAPID config accessor**

Create `lib/push/vapid.ts`:
```ts
export function getVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID keys are not configured');
  }
  return { publicKey, privateKey, subject };
}
```

- [ ] **Step 6: Write the subscribe/unsubscribe route**

Create `app/api/push/subscribe/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subscription } = await req.json();
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: req.headers.get('user-agent') ?? null,
    },
    { onConflict: 'endpoint' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

  const admin = createAdminClient();
  await admin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Build and verify the route rejects unauthenticated calls**

Run (with `npm run dev` running):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/push/subscribe -H 'Content-Type: application/json' -d '{}'
```
Expected: `401`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json scripts/check-env.js lib/supabase/admin.ts lib/push/vapid.ts app/api/push/subscribe/route.ts
git commit -m "feat(push): add VAPID config, admin client, and subscribe API"
```

---

### Task 7: Push payload builder + sender (with automated test)

**Files:**
- Create: `lib/push/payload.ts`
- Create: `lib/push/payload.test.ts`
- Create: `lib/push/sender.ts`

**Interfaces:**
- Consumes: `getVapid` (Task 6), `createAdminClient` (Task 6), `push_subscriptions` (Task 5).
- Produces:
  - type `PushPayload = { title: string; body: string; url?: string }`.
  - `buildPushPayload(p: PushPayload): string` (JSON string sent to devices) from `@/lib/push/payload`.
  - `sendPushToAll(payload: PushPayload): Promise<{ sent: number; pruned: number }>` from `@/lib/push/sender`.

- [ ] **Step 1: Write the failing test for the payload builder**

Create `lib/push/payload.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPushPayload } from './payload.ts';

test('buildPushPayload defaults url to /dashboard and encodes fields', () => {
  const json = buildPushPayload({ title: 'Alert', body: 'Fuel over budget' });
  const parsed = JSON.parse(json);
  assert.equal(parsed.title, 'Alert');
  assert.equal(parsed.body, 'Fuel over budget');
  assert.equal(parsed.url, '/dashboard');
});

test('buildPushPayload keeps a provided url', () => {
  const json = buildPushPayload({ title: 'A', body: 'B', url: '/dashboard/notifications' });
  assert.equal(JSON.parse(json).url, '/dashboard/notifications');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx tsx --test lib/push/payload.test.ts
```
Expected: FAIL — cannot find `buildPushPayload` / module `./payload.ts`.

- [ ] **Step 3: Write the payload builder**

Create `lib/push/payload.ts`:
```ts
export type PushPayload = { title: string; body: string; url?: string };

export function buildPushPayload(p: PushPayload): string {
  return JSON.stringify({
    title: p.title,
    body: p.body,
    url: p.url ?? '/dashboard',
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx tsx --test lib/push/payload.test.ts
```
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Write the sender**

Create `lib/push/sender.ts`:
```ts
import webpush from 'web-push';
import { getVapid } from './vapid';
import { buildPushPayload, type PushPayload } from './payload';
import { createAdminClient } from '@/lib/supabase/admin';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const { publicKey, privateKey, subject } = getVapid();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// Broadcast to every subscribed device. Prunes dead subscriptions (404/410).
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  ensureConfigured();
  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');
  if (error) throw new Error(error.message);
  if (!subs || subs.length === 0) return { sent: 0, pruned: 0 };

  const body = buildPushPayload(payload);
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body
      );
      sent += 1;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.endpoint);
      else console.error('push send error:', err?.statusCode, err?.body);
    }
  }));

  if (dead.length) {
    await admin.from('push_subscriptions').delete().in('endpoint', dead);
  }
  return { sent, pruned: dead.length };
}
```

- [ ] **Step 6: Type-check via build**

Run:
```bash
npm run build 2>&1 | tail -5
```
Expected: build completes.

- [ ] **Step 7: Commit**

```bash
git add lib/push/payload.ts lib/push/payload.test.ts lib/push/sender.ts
git commit -m "feat(push): add payload builder (tested) and broadcast sender"
```

---

### Task 8: Extend the service worker with push handlers

**Files:**
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: JSON payloads shaped `{ title, body, url }` from Task 7.

- [ ] **Step 1: Append push + notificationclick handlers to the service worker**

Add to the end of `public/sw.js`:
```js
self.addEventListener('push', (event) => {
  let data = { title: 'Impala Fleet', body: 'You have a new notification', url: '/dashboard' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) { c.navigate(target); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
```

- [ ] **Step 2: Bump the cache version so clients pick up the new SW**

In `public/sw.js`, change `const CACHE = 'impala-pwa-v1';` to `const CACHE = 'impala-pwa-v2';`.

- [ ] **Step 3: Verify the SW still serves and parses**

Run (with `npm run dev` running):
```bash
curl -s http://localhost:3000/sw.js | grep -c "addEventListener('push'"
```
Expected: `1`.

- [ ] **Step 4: Commit**

```bash
git add public/sw.js
git commit -m "feat(push): handle push and notificationclick in service worker"
```

---

### Task 9: Push opt-in component + mount

**Files:**
- Create: `components/PushOptIn.tsx`
- Modify: `app/layout.tsx` (mount `<PushOptIn />`)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `useAuth()`, `POST /api/push/subscribe` (Task 6).

- [ ] **Step 1: Write the opt-in component**

Create `components/PushOptIn.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
}

export function PushOptIn() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    // iOS: only offer after home-screen install.
    if (!isStandalone() && /iPad|iPhone|iPod/.test(navigator.userAgent)) return;
    if (Notification.permission === "granted" || Notification.permission === "denied") return;
    setShow(true);
  }, [user]);

  async function enable() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setShow(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch (err) {
      console.error("push subscribe failed:", err);
    } finally {
      setShow(false);
    }
  }

  if (!show) return null;
  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border bg-white p-4 shadow-lg">
      <p className="text-sm font-medium">Turn on notifications</p>
      <p className="mt-1 text-xs text-muted-foreground">Get alerts for fleet updates on this device.</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={enable}>Enable</Button>
        <Button size="sm" variant="ghost" onClick={() => setShow(false)}>Not now</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the layout**

In `app/layout.tsx`, render after `<ServiceWorkerRegister />`:
```tsx
import { PushOptIn } from "@/components/PushOptIn";
// ...
        <ServiceWorkerRegister />
        <PushOptIn />
```

- [ ] **Step 3: Build to confirm no type errors**

Run:
```bash
npm run build 2>&1 | tail -5
```
Expected: build completes.

- [ ] **Step 4: Commit**

```bash
git add components/PushOptIn.tsx app/layout.tsx
git commit -m "feat(push): add notification opt-in prompt"
```

---

### Task 10: Install prompt component + /install page

**Files:**
- Create: `components/InstallPrompt.tsx`
- Create: `app/install/page.tsx`
- Modify: `app/layout.tsx` (mount `<InstallPrompt />`)

**Interfaces:**
- Produces: a floating "Install app" button (Android) / iOS instruction sheet; a `/install` help page.

- [ ] **Step 1: Write the install prompt component**

Create `components/InstallPrompt.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || isStandalone()) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const inSafari = isIOS && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
    if (inSafari) setShowIOS(true);

    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (deferred) {
    return (
      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2">
        <Button onClick={async () => { deferred.prompt(); await deferred.userChoice; setDeferred(null); }}>
          Install app
        </Button>
      </div>
    );
  }
  if (showIOS) {
    return (
      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border bg-white p-4 shadow-lg text-sm">
        Install this app: tap <span className="font-semibold">Share</span> then{" "}
        <span className="font-semibold">Add to Home Screen</span>.
        <button className="ml-2 text-blue-600" onClick={() => setShowIOS(false)}>Dismiss</button>
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 2: Write the /install help page**

Create `app/install/page.tsx`:
```tsx
export default function InstallPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Install Impala Fleet</h1>
      <section className="mt-4">
        <h2 className="font-medium">iPhone / iPad (Safari)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Open this page in Safari.</li>
          <li>Tap the Share button.</li>
          <li>Tap “Add to Home Screen”.</li>
          <li>Open the app from its new home-screen icon.</li>
          <li>When asked, allow notifications.</li>
        </ol>
      </section>
      <section className="mt-6">
        <h2 className="font-medium">Android (Chrome)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Open this page in Chrome.</li>
          <li>Tap “Install app” (or menu → Install app).</li>
          <li>Open the app and allow notifications.</li>
        </ol>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Mount the prompt in the layout**

In `app/layout.tsx`, render after `<PushOptIn />`:
```tsx
import { InstallPrompt } from "@/components/InstallPrompt";
// ...
        <PushOptIn />
        <InstallPrompt />
```

- [ ] **Step 4: Build and verify /install renders**

Run (with `npm run dev` running):
```bash
npm run build 2>&1 | tail -3
curl -s http://localhost:3000/install | grep -c "Add to Home Screen"
```
Expected: build completes; grep returns `1`.

- [ ] **Step 5: Commit**

```bash
git add components/InstallPrompt.tsx app/install/page.tsx app/layout.tsx
git commit -m "feat(pwa): add install prompt and /install help page"
```

---

### Task 11: Hook push into the notifications trigger pipeline

**Files:**
- Modify: `app/api/notifications/trigger/route.ts`

**Interfaces:**
- Consumes: `sendPushToAll` (Task 7).

- [ ] **Step 1: Import the sender**

At the top of `app/api/notifications/trigger/route.ts`, add:
```ts
import { sendPushToAll } from '@/lib/push/sender';
```

- [ ] **Step 2: Fan out to devices after a successful WhatsApp broadcast**

In the `for` loop, immediately after `await notificationService.updateLastTriggered(notification.id);` (inside the `if (whatsappResult.success)` block), add:
```ts
        try {
          await sendPushToAll({
            title: notification.name,
            body: processedMessage,
            url: '/dashboard/notifications',
          });
        } catch (pushErr) {
          console.error('⚠️ Push fan-out failed (WhatsApp still sent):', pushErr);
        }
```

- [ ] **Step 3: Build to confirm no type errors**

Run:
```bash
npm run build 2>&1 | tail -5
```
Expected: build completes.

- [ ] **Step 4: Commit**

```bash
git add app/api/notifications/trigger/route.ts
git commit -m "feat(push): broadcast push on notification trigger"
```

---

### Task 12: Mobile polish + full verification pass (Impala)

**Files:**
- Modify: `app/globals.css` (safe-area helpers if needed)

**Interfaces:** none (verification task).

- [ ] **Step 1: Add safe-area padding utility to globals**

Append to `app/globals.css`:
```css
/* PWA standalone safe areas */
@supports (padding: max(0px)) {
  .pb-safe { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
  .pt-safe { padding-top: max(0px, env(safe-area-inset-top)); }
}
```

- [ ] **Step 2: Run the Lighthouse PWA installability check**

Run (with a production build served — `npm run build && npm run start`):
```bash
npx lighthouse http://localhost:3000/dashboard --only-categories=pwa --quiet --chrome-flags="--headless" --output=json --output-path=./lighthouse-pwa.json || true
grep -oE '"(installable-manifest|service-worker|maskable-icon|apple-touch-icon)"[^}]*"score":[0-9.]+' lighthouse-pwa.json | head
```
Expected: `installable-manifest` and `service-worker` audits present with `"score":1`.

- [ ] **Step 3: Real-device manual verification checklist (record results in the commit body)**

Perform and confirm each:
- Android Chrome: open the deployed URL → "Install app" appears → install → app opens fullscreen from home screen.
- Android installed: `<PushOptIn>` appears → Enable → grant → fire a trigger (`POST /api/notifications/trigger`) → notification received → tap opens `/dashboard/notifications`.
- iPhone Safari: open URL → follow `/install` steps → Add to Home Screen → open from icon (fullscreen, no Safari bars).
- iPhone installed (iOS 16.4+): `<PushOptIn>` appears → Enable → grant → trigger → notification received.
- iPhone NOT installed: confirm no permission prompt is thrown (opt-in stays hidden).
- Offline: kill network on a navigation → offline page shows.
- Standalone login: log out and back in inside the installed app, incl. `/auth/callback` — session persists.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css lighthouse-pwa.json
git commit -m "chore(pwa): safe-area helpers and Lighthouse/device verification"
```

---

### Task 13: Port + rebrand to Royal Express

**Files (in `royalexpress-fleet-manager`):**
- Create: `public/logo-source.svg` (red background, white "R")
- Copy from Impala (identical): `scripts/generate-icons.mjs`, `app/manifest.ts`, `components/ServiceWorkerRegister.tsx`, `components/PushOptIn.tsx`, `components/InstallPrompt.tsx`, `app/install/page.tsx`, `public/sw.js`, `public/offline.html`, `lib/supabase/admin.ts`, `lib/push/vapid.ts`, `lib/push/payload.ts`, `lib/push/payload.test.ts`, `lib/push/sender.ts`, `app/api/push/subscribe/route.ts`, `supabase/migrations/20260705000001_create_push_subscriptions.sql`
- Modify: `app/layout.tsx`, `app/api/notifications/trigger/route.ts`, `scripts/check-env.js`, `package.json`, `.env.local` (Royal Express VAPID keys)
- Rebrand values in: `app/manifest.ts`, `app/layout.tsx`, `public/sw.js`, `public/offline.html`, `app/install/page.tsx`, `components/*` copy

**Interfaces:** mirrors Tasks 1–12 for the second repo.

- [ ] **Step 1: Author the Royal Express icon source (red bg, white "R")**

Create `royalexpress-fleet-manager/public/logo-source.svg`:
```svg
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#dc2626"/>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="central"
        font-family="Arial, Helvetica, sans-serif" font-weight="700"
        font-size="300" fill="#ffffff">R</text>
</svg>
```

- [ ] **Step 2: Install deps and generate icons from the red-R source**

Run (in `royalexpress-fleet-manager`):
```bash
npm install web-push && npm install --save-dev @types/web-push sharp
npm run icons -- public/logo-source.svg '#dc2626'
```
(After copying `scripts/generate-icons.mjs` and adding the `icons` script per Task 1 Step 1.)
Expected: red-background white-R PNGs in `public/icons/`.

- [ ] **Step 3: Copy the shared files listed above and swap brand values**

Copy each identical file from Impala. Then change brand strings:
- `app/manifest.ts`: `name: 'Royal Express Fleet Manager'`, `short_name: 'Royal Express'`, `theme_color: '#dc2626'`.
- `app/layout.tsx`: `applicationName`/`appleWebApp.title` → `"Royal Express"`; `viewport.themeColor` → `'#dc2626'`.
- `public/sw.js`: `CACHE = 'royalexpress-pwa-v1'`; default push title `'Royal Express'`.
- `public/offline.html` + `app/install/page.tsx` + component copy: replace "Impala Fleet" → "Royal Express".

- [ ] **Step 4: Generate Royal Express VAPID keys and set env + check-env**

Run:
```bash
npx web-push generate-vapid-keys --json
```
Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` to `royalexpress-fleet-manager/.env.local`, and extend `scripts/check-env.js` requiredVars exactly as in Task 6 Step 3.

- [ ] **Step 5: Apply the push_subscriptions migration to the Royal Express Supabase project**

Apply the copied migration via the Royal Express Supabase SQL editor. Verify columns as in Task 5 Step 3.

- [ ] **Step 6: Wire trigger + layout mounts (mirror Tasks 9–11)**

In `app/layout.tsx` mount `<ServiceWorkerRegister />`, `<PushOptIn />`, `<InstallPrompt />`. In `app/api/notifications/trigger/route.ts` add the `sendPushToAll` import and the fan-out block (Task 11), with `url: '/dashboard/notifications'`.

- [ ] **Step 7: Build, test, and verify**

Run:
```bash
npx tsx --test lib/push/payload.test.ts
npm run build 2>&1 | tail -5
```
Expected: payload tests pass; build completes. Then repeat the Task 12 Step 3 device checklist for Royal Express.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(pwa): port installable PWA + push to Royal Express (red-R branding)"
```

---

## Deployment note (both repos)

Set the three VAPID env vars (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) and confirm `SUPABASE_SERVICE_ROLE_KEY` exists in each hosting environment (Railway/Vercel) before deploying. `check-env.js` will fail the build if the VAPID vars are missing. After deploy, share the hosted URL (or `/install`) with employees.
