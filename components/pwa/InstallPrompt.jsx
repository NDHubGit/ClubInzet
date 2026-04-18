"use client";

import { useCallback, useEffect, useState } from "react";

const DISMISS_STORAGE_KEY = "clubinzet_install_prompt_dismissed";

function isInstalledPwa() {
  if (typeof window === "undefined") return true;
  const mq = window.matchMedia("(display-mode: standalone)");
  if (mq.matches) return true;
  if (window.navigator.standalone === true) return true;
  return false;
}

/**
 * Chrome/Edge (Android/desktop): beforeinstallprompt → custom "Installeer app".
 * Safari iOS: geen event; gebruiker gebruikt Deel → Zet op beginscherm.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInstalledPwa()) return;
    try {
      if (window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      /* private mode / storage disabled */
    }

    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
  }, [deferred]);

  if (dismissed || !deferred || isInstalledPwa()) return null;

  return (
    <div
      className="fixed bottom-4 left-3 right-3 z-[9998] flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f172a]/95 px-4 py-3 shadow-xl backdrop-blur-md sm:left-auto sm:right-4 sm:max-w-md"
      role="dialog"
      aria-label="App installeren"
    >
      <p className="text-sm text-slate-200">
        Installeer <strong className="text-white">ClubInzet</strong> voor snelle toegang en offline ondersteuning.
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
          onClick={() => {
            try {
              window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
        >
          Later
        </button>
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          onClick={onInstall}
        >
          Installeer app
        </button>
      </div>
    </div>
  );
}
