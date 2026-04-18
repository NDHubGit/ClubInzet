"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AddPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#94a3b8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 15,
      }}
    >
      Doorverwijzen naar het dashboard…
    </div>
  );
}
