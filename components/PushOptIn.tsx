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
