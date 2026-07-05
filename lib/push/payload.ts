export type PushPayload = { title: string; body: string; url?: string };

export function buildPushPayload(p: PushPayload): string {
  return JSON.stringify({
    title: p.title,
    body: p.body,
    url: p.url ?? '/dashboard',
  });
}
