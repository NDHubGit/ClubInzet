import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

import InstallPrompt from "@/components/pwa/InstallPrompt";

export const metadata: Metadata = {
  title: "ClubInzet",
  description: "Clubtaken en punten bijhouden",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "ClubInzet",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: "#0f172a",
  colorScheme: "dark" as const,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <div className="wrap">{children}</div>
        <InstallPrompt />
      </body>
    </html>
  );
}
