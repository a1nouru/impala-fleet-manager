export default function InstallPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Install Impala Fleet</h1>
      <section className="mt-4">
        <h2 className="font-medium">iPhone / iPad (Safari)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Open this page in Safari.</li>
          <li>Tap the Share button.</li>
          <li>Tap "Add to Home Screen".</li>
          <li>Open the app from its new home-screen icon.</li>
          <li>When asked, allow notifications.</li>
        </ol>
      </section>
      <section className="mt-6">
        <h2 className="font-medium">Android (Chrome)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Open this page in Chrome.</li>
          <li>Tap "Install app" (or menu → Install app).</li>
          <li>Open the app and allow notifications.</li>
        </ol>
      </section>
    </main>
  );
}
