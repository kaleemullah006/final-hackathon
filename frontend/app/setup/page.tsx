"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Setup is only available on a fresh install
  useEffect(() => {
    async function check() {
      try {
        const status = await apiFetch<{ needsSetup: boolean }>("/setup/status");
        if (!status.needsSetup) {
          router.replace("/login");
          return;
        }
        setChecking(false);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
        setChecking(false);
      }
    }

    check();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    if (adminPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/setup", {
        method: "POST",
        body: { companyName, adminName, adminEmail, adminPassword },
      });
      router.replace("/login");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Setup failed.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <main className="login-page">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Set up HCM Lite</h1>
        <p>Create your company and the Admin account.</p>

        <label htmlFor="companyName">Company name</label>
        <input
          id="companyName"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />

        <label htmlFor="adminName">Admin name</label>
        <input
          id="adminName"
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          autoComplete="name"
          required
        />

        <label htmlFor="adminEmail">Admin email</label>
        <input
          id="adminEmail"
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label htmlFor="adminPassword">Password (8+ characters)</label>
        <input
          id="adminPassword"
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />

        <label htmlFor="confirmPassword">Confirm password</label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create company and Admin"}
        </button>

        {message && (
          <p className="login-message" role="alert">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
