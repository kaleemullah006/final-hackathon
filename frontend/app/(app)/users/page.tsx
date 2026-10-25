"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Alert, Badge, Empty, Field, Loading, PageHeader, RequireRole, TempPasswordBox, errorText } from "@/components/ui";

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "hr" | "employee";
  isActive: boolean;
  mustChangePassword: boolean;
};

type TempLogin = { title: string; email: string; password: string };

const ROLE_LABEL = { admin: "Admin", hr: "HR", employee: "Employee" } as const;

function Logins() {
  const me = useSession();

  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<TempLogin | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch<{ users: AppUser[] }>(
          `/users${roleFilter ? `?role=${roleFilter}` : ""}`,
          { auth: true }
        );
        if (!cancelled) setUsers(data.users);
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [roleFilter, reloadKey]);

  const run = async (action: () => Promise<string | void>) => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const text = await action();
      if (text) setMessage(text);
      setReloadKey((key) => key + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const createHr = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTemp(null);
    await run(async () => {
      const result = await apiFetch<{ login: { email: string; tempPassword: string } }>("/users/hr", {
        method: "POST",
        auth: true,
        body: { name, email },
      });
      setTemp({ title: "HR login created", email: result.login.email, password: result.login.tempPassword });
      setName("");
      setEmail("");
    });
  };

  const setActive = async (user: AppUser, isActive: boolean) => {
    if (!isActive && !window.confirm(`Deactivate ${user.name}? They will not be able to log in.`)) return;
    await run(async () => {
      await apiFetch(`/users/${user.id}/active`, { method: "PATCH", auth: true, body: { isActive } });
      return isActive ? "Login activated." : "Login deactivated.";
    });
  };

  const reset = async (user: AppUser) => {
    if (!window.confirm(`Reset the password of ${user.name}?`)) return;
    setTemp(null);
    await run(async () => {
      const result = await apiFetch<{ login: { email: string; tempPassword: string } }>(
        `/users/${user.id}/reset-password`,
        { method: "POST", auth: true }
      );
      setTemp({ title: "Password reset", email: result.login.email, password: result.login.tempPassword });
    });
  };

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}
      {temp && <TempPasswordBox {...temp} onClose={() => setTemp(null)} />}

      <form className="hx-card" onSubmit={createHr}>
        <h2>Create an HR login</h2>
        <div className="hx-inline">
          <Field label="Name" htmlFor="hr-name">
            <input id="hr-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </Field>
          <Field label="Email" htmlFor="hr-email">
            <input id="hr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <button type="submit" className="hx-btn" disabled={busy}>
            Create HR login
          </button>
        </div>
      </form>

      <div className="hx-card">
        <div className="hx-inline" style={{ marginBottom: 12 }}>
          <Field label="Show" htmlFor="role-filter">
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => {
                setUsers(null);
                setRoleFilter(e.target.value);
              }}
            >
              <option value="">All logins</option>
              <option value="admin">Admins</option>
              <option value="hr">HR</option>
              <option value="employee">Employees</option>
            </select>
          </Field>
        </div>

        {!users && !error && <Loading />}
        {users && users.length === 0 && <Empty>No logins found.</Empty>}
        {users && users.length > 0 && (
          <div className="hx-table-wrap">
            <table className="hx-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const self = user.id === me.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        {user.name} {self && <Badge>You</Badge>}
                      </td>
                      <td>{user.email}</td>
                      <td>{ROLE_LABEL[user.role]}</td>
                      <td>
                        <Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Deactivated"}</Badge>{" "}
                        {user.mustChangePassword && <Badge tone="amber">Temp password</Badge>}
                      </td>
                      <td>
                        {self ? (
                          "-"
                        ) : (
                          <div className="hx-row-actions">
                            <button type="button" className="hx-btn hx-light hx-small" disabled={busy} onClick={() => setActive(user, !user.isActive)}>
                              {user.isActive ? "Deactivate" : "Activate"}
                            </button>
                            <button type="button" className="hx-btn hx-light hx-small" disabled={busy} onClick={() => reset(user)}>
                              Reset password
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function UsersPage() {
  return (
    <RequireRole roles={["admin"]}>
      <PageHeader title="Logins" subtitle="Create HR logins, switch logins on or off and reset passwords" />
      <Logins />
    </RequireRole>
  );
}
