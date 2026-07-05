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
