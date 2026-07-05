# Mobile App (Installable PWA + Push) — Design

**Date:** 2026-07-05
**Applies to:** `impala-fleet-manager` and `royalexpress-fleet-manager` (near-identical repos; implement in both)
**Status:** Approved, ready for implementation planning

## Goal

Give employees a "mobile app" for the Impala and Royal Express fleet managers that they
install from a shared link (no app store), can use for the full app on their phone, and that
delivers **real push notifications** — on both Android and iPhone.

## Approach (decided)

Ship each existing Next.js app as an **installable Progressive Web App (PWA)** plus a
**Web Push** layer. No native rewrite, no Capacitor/APK, no app store.

Why PWA:
- Both apps are hosted Next.js 15 (App Router) + React 19 + Supabase + Tailwind v4, already
  meaningfully responsive (343 `sm:` / 69 `md:` / 60 `lg:` breakpoint uses, drawer nav via
  `md:hidden`, scrollable tables). "Full app on mobile" is a packaging + polish problem, not a
  rewrite.
- SSR + middleware + Supabase-SSR means the app **cannot** be statically exported/bundled, so
  the mobile app loads the already-hosted URL. A PWA does exactly this while adding a
  home-screen icon, fullscreen standalone mode, and push.
- One codebase serves both platforms from one link; every deploy updates everyone instantly.
- Push notifications are supported: Android/Chrome fully; **iOS 16.4+ when installed to the
  home screen** (standalone), which we do anyway.

Explicitly **out of scope for v1** (structured so they can be added later without rework):
Capacitor/APK, app store, offline data sync, per-user/role push targeting, native device APIs.

## Delivery model

No new app. A PWA layer is added to each existing app. Employees receive the hosted URL (one
link per company). Installing creates a fullscreen home-screen app that loads the live app with
every feature. Implemented **identically in both repos**; only branding differs.

### iOS install requirement (must communicate to users)
On iPhone, push notifications work **only** after the user does Safari → Share →
**"Add to Home Screen"** once. In a plain Safari tab there is no push. This is Apple's rule.
The install UX must guide iPhone users through this step and only request notification
permission after install. Android/Chrome shows a one-tap "Install app" prompt.

## Components

Each is a small, isolated unit.

1. **Web app manifest** — `app/manifest.ts` (Next.js metadata route). Fields: `name`,
   `short_name`, `theme_color`, `background_color`, `display: standalone`, `start_url`,
   portrait `orientation`, `id`, and the icon set. Per-brand values.

2. **Icon + splash asset set** — generated per brand and placed in `public/icons/`:
   192×192, 512×512, maskable 512×512, apple-touch-icon 180×180, favicon.
   - **Impala:** keep existing branding/images; generate icons from current assets.
   - **Royal Express:** icons = **red background, white letter "R"**.

3. **Head / viewport metadata** — root-layout `viewport` export: `theme-color`,
   `viewport-fit=cover` (notch safe-areas). Apple meta tags: `apple-mobile-web-app-capable`,
   `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, and the
   `apple-touch-icon` link.

4. **Service worker** — `public/sw.js`, registered by a small client component
   (`ServiceWorkerRegister`). Responsibilities:
   - **Caching:** network-first; cache only static assets + one offline fallback page.
     **Never cache authenticated pages or API responses** — respects existing no-cache headers
     on `/api`, `/admin`, `/dashboard`, `/profile`; avoids stale or leaked data.
   - **Push:** `push` handler renders an OS notification (title/body/icon/URL);
     `notificationclick` focuses an existing window or opens the app at the target page.
   - **Updates:** `skipWaiting` + prompt clients to reload on new SW.

5. **Install prompt UX** — `<InstallPrompt/>` client component.
   - Android/Chrome: capture `beforeinstallprompt` → custom "Install app" button.
   - iOS/Safari: detect iOS + non-standalone → show "Add to Home Screen" instruction sheet.
   - Detect in-app browsers (WhatsApp/Instagram previews) that can't install → tell the user to
     open in Safari/Chrome.

6. **Mobile polish pass** — safe-area insets; verify drawer nav works in standalone; tap-target
   sizing; confirm full in-app navigation (no reliance on a browser back button); confirm table
   horizontal scroll. Scoped by a QA checklist, **not** a screen rewrite.

7. **Install / onboarding guide** — a `/install` page that auto-detects platform and shows
   step-by-step install instructions, plus a short doc to send alongside the link.

8. **Web Push backend** — new infrastructure:
   - **VAPID keys** per app in env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (+ public key
     exposed to client as needed).
   - **Subscription storage** — new Supabase table `push_subscriptions`
     (`id`, `user_id`, `endpoint` unique, `p256dh`, `auth`, `user_agent`, `created_at`), with
     RLS so a user manages only their own subscriptions.
   - **Subscribe route** — `POST /api/push/subscribe` stores the subscription;
     `POST /api/push/unsubscribe` (or DELETE) removes it.
   - **Sender utility** — `sendPush(recipients, payload)` using the `web-push` library; prunes
     dead subscriptions on 404/410.
   - **Trigger integration** — hook `sendPush` into the **existing**
     `app/api/notifications/trigger` pipeline so every event that currently broadcasts to
     WhatsApp **also** fans out to all subscribed devices for that company.

9. **Permission / subscribe UX** — `<PushOptIn/>` client component. Once the app is installed
   (standalone), request notification permission at a sensible moment and register the
   subscription with the backend. On iOS, if not installed, prompt to install first (permission
   would otherwise fail silently).

## Behavior, data flow, and edge cases

- **Data/auth flow unchanged** — same SSR + Supabase. The SW only touches static assets + the
  offline fallback. Auth flows through existing routes.
- **Auth in standalone (verify during impl):** confirm the `/auth/callback` login flow works
  inside an iOS installed PWA (a known PWA gotcha). Flag if any OAuth-in-standalone issue.
- **Recipient rule (v1):** push fires to **all subscribed devices for that company** — broadcast
  parity with the existing WhatsApp alerts. Per-user/role targeting deferred.
- **Offline:** show the offline fallback page.
- **SW update:** prompt to reload.
- **iOS not installed:** push subscribe gracefully no-ops; UX steers the user to install first.

## Testing

Run per app:
- **Lighthouse PWA installability audit** must pass.
- **Install + launch** on Android Chrome and iOS Safari (standalone opens fullscreen).
- **Standalone login** works (incl. `/auth/callback`).
- **Offline fallback** renders when offline.
- **Push end-to-end** on Android Chrome and iOS 16.4+ installed PWA: permission → subscribe →
  existing trigger fires → notification received → tap opens correct page. Verify iOS no-ops
  cleanly when not installed.

## Per-brand config summary

| Item | Impala | Royal Express |
|------|--------|---------------|
| Branding / images | Keep existing | Keep existing app UI |
| App icon | From existing assets | Red background, white "R" |
| Manifest name/colors | Impala values | Royal Express values |
| VAPID keys | Impala's own | Royal Express's own |
| `push_subscriptions` table | Impala Supabase | Royal Express Supabase |

## Implementation note

Repos are near-identical mirrors — apply every change to both. Differences are only branding,
icons, manifest values, and each app's own VAPID keys / Supabase project.
