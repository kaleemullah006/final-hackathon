"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, clearSession, getToken, saveUser, type Role, type SessionUser } from "@/lib/api";
import { SessionProvider } from "@/lib/session";

type NavItem = { href: string; label: string };
type NavGroup = { label?: string; items: NavItem[] };

const ORGANIZATION: NavItem[] = [
  { href: "/settings", label: "Company settings" },
  { href: "/departments", label: "Departments" },
  { href: "/designations", label: "Designations" },
  { href: "/leave-types", label: "Leave types" },
  { href: "/holidays", label: "Holidays" },
];

// Menus are a convenience only: the server checks the role again on every request
const NAV: Record<Role, NavGroup[]> = {
  admin: [
    { items: [{ href: "/dashboard", label: "Dashboard" }, { href: "/employees", label: "Employees" }] },
    { label: "Admin", items: [{ href: "/users", label: "Logins" }] },
    { label: "Organization", items: ORGANIZATION },
  ],
  hr: [
    { items: [{ href: "/dashboard", label: "Dashboard" }, { href: "/employees", label: "Employees" }] },
    { label: "Organization (view)", items: ORGANIZATION },
  ],
  employee: [
    { items: [{ href: "/dashboard", label: "Dashboard" }, { href: "/my-profile", label: "My profile" }] },
  ],
};

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", hr: "HR", employee: "Employee" };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const logout = () => {
    clearSession();
    router.replace("/login");
  };

  if (!user) {
    return (
      <div className="hx-root">
        <div className="hx-content">
          <p className="hx-loading">Loading...</p>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <SessionProvider value={user}>
      <div className="hx-root">
        <aside className={`hx-side${menuOpen ? " hx-open" : ""}`}>
          <div className="hx-brand">
            HCM Lite
            <small>{ROLE_LABEL[user.role]} workspace</small>
          </div>

          <nav className="hx-nav" aria-label="Main menu">
            {NAV[user.role].map((group, index) => (
              <div key={index} style={{ display: "contents" }}>
                {group.label && <div className="hx-nav-label">{group.label}</div>}
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive(item.href) ? "hx-active" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="hx-user">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <Link href="/change-password" className="hx-nav-link" style={{ display: "block", marginTop: 8, color: "#9fb0d0", fontSize: 13 }}>
              Change password
            </Link>
            <button type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </aside>

        <div className="hx-main">
          <div className="hx-topbar">
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Open menu">
              Menu
            </button>
            <strong>HCM Lite</strong>
          </div>
          <main className="hx-content">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
