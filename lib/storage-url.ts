import { createClient } from '@/lib/supabase/client'

/**
 * Storage buckets were made private (security remediation). Files are stored in
 * the DB as legacy public URLs (…/storage/v1/object/public/<bucket>/<path>).
 * These helpers derive the bucket+path from a stored value and mint a fresh,
 * short-lived SIGNED url on demand, so viewing/downloading keeps working without
 * re-opening the buckets. Signing happens at click time, so URLs never expire.
 */

const PUBLIC_URL_RE = /\/storage\/v1\/object\/(?:public|sign)\/([^/?]+)\/([^?]+)/

const DEFAULT_TTL = 60 * 60 // 1 hour

/** Extract { bucket, path } from a stored public/sign URL, or null if not one. */
export function parseStoredStoragePath(
  stored: string
): { bucket: string; path: string } | null {
  if (!stored) return null
  const m = stored.match(PUBLIC_URL_RE)
  if (!m) return null
  return { bucket: m[1], path: decodeURIComponent(m[2]) }
}

/**
 * Turn a stored storage reference into a fresh signed URL.
 * - Recognised public/sign storage URLs are re-signed.
 * - Anything else (already-signed external link, blob:, data:, or an
 *   unrecognised value) is returned unchanged so nothing breaks.
 */
export async function signStoredUrl(
  stored: string | null | undefined,
  ttl: number = DEFAULT_TTL
): Promise<string | null> {
  if (!stored) return stored ?? null
  const parsed = parseStoredStoragePath(stored)
  if (!parsed) return stored
  try {
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, ttl)
    if (error || !data?.signedUrl) return stored
    return data.signedUrl
  } catch {
    return stored
  }
}

/** Batch variant preserving order; nulls pass through. */
export async function signStoredUrls(
  stored: Array<string | null | undefined>,
  ttl: number = DEFAULT_TTL
): Promise<Array<string | null>> {
  return Promise.all(stored.map((s) => signStoredUrl(s, ttl)))
}

/**
 * Open a stored file in a new tab using a freshly signed URL.
 * Opens a blank tab synchronously first so popup blockers don't fire after the
 * async signing step, then redirects it once the signed URL is ready.
 */
export async function openStoredFile(
  stored: string | null | undefined,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  if (!stored) return
  const win = window.open('', '_blank', 'noopener,noreferrer')
  const url = await signStoredUrl(stored, ttl)
  if (!url) {
    win?.close()
    return
  }
  if (win) {
    win.location.href = url
  } else {
    // popup blocked / no window handle — fall back to same-tab navigation
    window.location.href = url
  }
}
