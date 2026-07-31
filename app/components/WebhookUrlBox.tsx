"use client";

import { useEffect, useState } from "react";

export function WebhookUrlBox({ path }: { path: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  // window.location is only known after mount — start blank (matches SSR
  // output) so there's nothing to hydrate against, then fill in client-side.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs with window.location, a browser-only global, not derived from props
    setOrigin(window.location.origin);
  }, []);

  const fullUrl = `${origin}${path}`;

  async function copy() {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={fullUrl}
        onFocus={(e) => e.target.select()}
        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-700"
      />
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
