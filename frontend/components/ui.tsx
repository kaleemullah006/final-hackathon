"use client";

import { useState } from "react";
import type { Role } from "@/lib/api";
import { useSession } from "@/lib/session";

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="hx-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}

export function Alert({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  return (
    <div className={`hx-alert hx-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Loading({ text = "Loading..." }: { text?: string }) {
  return <p className="hx-loading">{text}</p>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="hx-empty">{children}</div>;
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hx-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone?: "green" | "amber" | "red";
  children: React.ReactNode;
}) {
  return <span className={`hx-badge${tone ? ` hx-${tone}` : ""}`}>{children}</span>;
}

// Shows a page only to the listed roles. The server still enforces the same rule.
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const user = useSession();
  if (!roles.includes(user.role)) {
    return <Alert kind="error">You do not have access to this page.</Alert>;
  }
  return <>{children}</>;
}

// A temporary password is returned by the server only once, so it is shown here until closed
export function TempPasswordBox({
  title,
  email,
  password,
  onClose,
}: {
  title: string;
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="hx-temp" role="status">
      <strong>{title}</strong>
      <p style={{ margin: "6px 0" }}>
        Login: <b>{email}</b>
      </p>
      <code>{password}</code>
      <button type="button" className="hx-btn hx-light hx-small" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
        This password is shown only once. The user must change it at first sign-in.
      </p>
      <div className="hx-actions">
        <button type="button" className="hx-btn hx-light hx-small" onClick={onClose}>
          I have shared it, close
        </button>
      </div>
    </div>
  );
}
