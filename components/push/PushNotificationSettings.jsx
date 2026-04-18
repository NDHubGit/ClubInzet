"use client";

import { useCallback, useEffect, useState } from "react";

import { getNotificationPermissionState, subscribeUser } from "@/lib/notifications/subscribe";

function labelForPermission(p) {
  if (p === "unsupported") return "niet beschikbaar";
  if (p === "granted") return "toegestaan";
  if (p === "denied") return "geblokkeerd";
  return "nog niet gevraagd";
}

export default function PushNotificationSettings({ getAccessToken }) {
  const [perm, setPerm] = useState("default");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const refresh = useCallback(() => {
    setPerm(getNotificationPermissionState());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleEnable() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await subscribeUser(getAccessToken);
      if (!result.ok) {
        setMsg(result.error);
      } else {
        setMsg("Notificaties ingeschakeld.");
      }
    } catch (e) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const swOk = typeof window !== "undefined" && "serviceWorker" in navigator;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        borderRadius: 12,
        background: "rgba(0,0,0,0.22)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, opacity: 0.95 }}>Notificaties</p>
      <p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.75, lineHeight: 1.45 }}>
        Status: <strong style={{ color: "#e2e8f0" }}>{labelForPermission(perm)}</strong>
        {!swOk ? (
          <>
            {" "}
            — Service Worker alleen in productie (PWA). Push testen: <code style={{ fontSize: 11 }}>npm run build</code>{" "}
            + <code style={{ fontSize: 11 }}>npm start</code>.
          </>
        ) : null}
      </p>
      <button
        type="button"
        disabled={busy || perm === "denied" || !swOk}
        onClick={handleEnable}
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          border: "1px solid rgba(96,165,250,0.45)",
          background: perm === "denied" ? "rgba(255,255,255,0.06)" : "rgba(59,130,246,0.35)",
          color: "#f8fafc",
          fontWeight: 600,
          fontSize: 14,
          cursor: busy || perm === "denied" || !swOk ? "not-allowed" : "pointer",
          opacity: perm === "denied" || !swOk ? 0.55 : 1,
        }}
      >
        {busy ? "Bezig…" : "Zet notificaties aan 🔔"}
      </button>
      {perm === "denied" ? (
        <p style={{ margin: "10px 0 0", fontSize: 12, opacity: 0.7 }}>
          Deblokkeer notificaties in je browserinstellingen voor deze site.
        </p>
      ) : null}
      {msg ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>{msg}</p>
      ) : null}
    </div>
  );
}
