const defaultCache = require("next-pwa/cache");

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  /** Web Push event handler (naast workbox); pad relatief tot origin */
  importScripts: ["/push-sw.js"],
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline.html",
  },
  /**
   * Supabase eerst (specifiek); daarna next-pwa defaults (o.a. /api/* NetworkFirst, cross-origin).
   * NetworkFirst: online voorkeur, kort cache-fallback voor offline UX.
   */
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/[^/]+\.supabase\.co\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "supabase-clubinzet",
        networkTimeoutSeconds: 15,
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 5 * 60,
        },
      },
    },
    ...defaultCache,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.68.76"],
};

module.exports = withPWA(nextConfig);
