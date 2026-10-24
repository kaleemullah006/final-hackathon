"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearSession, getToken, saveUser, type SessionUser } from "@/lib/api";

const ROLE_LABEL = {
  admin: "Admin",
  hr: "HR",
  employee: "Employee",
} as const;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    async function load() {
      if (!getToken()) {
        router.replace("/login");
        return;
      }

      try {
        // The server is the source of truth for who you are and what role you have
        const data = await apiFetch<{ user: SessionUser }>("/auth/me", { auth: true });

        if (data.user.mustChangePassword) {
          router.replace("/change-password");
          return;
        }

        saveUser(data.user);
        setUser(data.user);
      } catch {
        clearSession();
        router.replace("/login");
      }
    }

    load();
  }, [router]);

  const handleLogout = () => {
    clearSession();
    router.replace("/login");
  };

  if (!user) {
    return (
      <main className="login-page">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Welcome, {user.name}</h1>
        <p>
          {ROLE_LABEL[user.role]} dashboard · {user.email}
        </p>
        <p>Your {ROLE_LABEL[user.role]} modules will appear here.</p>

        <button type="button" onClick={() => router.push("/change-password")}>
          Change password
        </button>
        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </main>
  );
}
