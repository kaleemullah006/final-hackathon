"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

// Entry point: fresh install -> /setup, logged in -> /dashboard, otherwise -> /login
export default function HomePage() {
  const router = useRouter();
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    async function decide() {
      try {
        const status = await apiFetch<{ needsSetup: boolean }>("/setup/status");

        if (status.needsSetup) {
          router.replace("/setup");
        } else if (getToken()) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    }

    decide();
  }, [router]);

  return (
    <main className="login-page">
      <p>{message}</p>
    </main>
  );
}
