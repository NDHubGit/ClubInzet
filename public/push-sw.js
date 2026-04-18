/**
 * Web Push handler — wordt door next-pwa in de gegenereerde /public/sw.js geladen via importScripts.
 * Bewerk dit bestand; niet handmatig sw.js aanpassen (wordt bij build overschreven).
 */
/* eslint-disable no-undef */
self.addEventListener("push", function (event) {
  let data = { title: "ClubInzet", body: "" };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (_) {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "ClubInzet", {
      body: data.body || "",
      icon: "/icon-192.png",
      data: data.data,
    })
  );
});
