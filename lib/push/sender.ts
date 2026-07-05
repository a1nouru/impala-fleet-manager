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
