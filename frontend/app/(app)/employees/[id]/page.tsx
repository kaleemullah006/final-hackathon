"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Alert, Badge, Loading, PageHeader, RequireRole, TempPasswordBox, errorText } from "@/components/ui";
import EmployeeForm, { type Employee, type Option } from "@/components/EmployeeForm";

type TempLogin = { title: string; email: string; password: string };

const money = (value: number) => new Intl.NumberFormat().format(value);

function EmployeeDetail({ id }: { id: string }) {
  const user = useSession();
  const isHr = user.role === "hr";
  const isAdmin = user.role === "admin";

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<TempLogin | null>(null);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch<{ employee: Employee }>(`/employees/${id}`, { auth: true });
        if (!cancelled) setEmployee(data.employee);
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Only HR edits, so only HR needs the active lists
  useEffect(() => {
    if (!isHr) return;
    async function loadOptions() {
      try {
        const [d, g] = await Promise.all([
          apiFetch<{ departments: Option[] }>("/departments?active=true", { auth: true }),
          apiFetch<{ designations: Option[] }>("/designations?active=true", { auth: true }),
        ]);
        setDepartments(d.departments);
        setDesignations(g.designations);
      } catch (e) {
        setError(errorText(e));
      }
    }

    loadOptions();
  }, [isHr]);

  const save = async (body: Record<string, unknown>) => {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await apiFetch(`/employees/${id}`, { method: "PATCH", auth: true, body });
      setReloadKey((key) => key + 1);
      setEditing(false);
      setMessage(body.status === "exited" ? "Saved. The login has been switched off." : "Saved.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleLogin = async () => {
    if (!employee || !employee.userId || !employee.login) return;
    const next = !employee.login.isActive;
    if (!next && !window.confirm(`Deactivate the login of ${employee.name}?`)) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await apiFetch(`/users/${employee.userId}/active`, { method: "PATCH", auth: true, body: { isActive: next } });
      setReloadKey((key) => key + 1);
      setMessage(next ? "Login activated." : "Login deactivated.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!employee || !employee.userId) return;
    if (!window.confirm(`Reset the password of ${employee.name}?`)) return;
    setError("");
    setMessage("");
    setTemp(null);
    setBusy(true);
    try {
      const result = await apiFetch<{ login: { email: string; tempPassword: string } }>(
        `/users/${employee.userId}/reset-password`,
        { method: "POST", auth: true }
      );
      setTemp({ title: "Password reset", email: result.login.email, password: result.login.tempPassword });
      setReloadKey((key) => key + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!employee) {
    return error ? <Alert kind="error">{error}</Alert> : <Loading />;
  }

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}
      {temp && <TempPasswordBox {...temp} onClose={() => setTemp(null)} />}

      {editing ? (
        <div className="hx-card">
          <h2>Edit employee</h2>
          <EmployeeForm
            initial={employee}
            departments={departments}
            designations={designations}
            submitting={saving}
            submitLabel="Save changes"
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="hx-card">
          <h2>
            {employee.name}{" "}
            <Badge tone={employee.status === "active" ? "green" : employee.status === "probation" ? "amber" : undefined}>
              {employee.status}
            </Badge>
          </h2>
          <dl className="hx-kv">
            <dt>Employee code</dt>
            <dd>{employee.code}</dd>
            <dt>Email</dt>
            <dd>{employee.email}</dd>
            <dt>Phone</dt>
            <dd>{employee.phone || "-"}</dd>
            <dt>Address</dt>
            <dd>{employee.address || "-"}</dd>
            <dt>Gender</dt>
            <dd style={{ textTransform: "capitalize" }}>{employee.gender}</dd>
            <dt>Department</dt>
            <dd>{employee.department.name}</dd>
            <dt>Designation</dt>
            <dd>{employee.designation.name}</dd>
            <dt>Joining date</dt>
            <dd>{employee.joiningDate}</dd>
            {employee.exitDate && (
              <>
                <dt>Exit date</dt>
                <dd>{employee.exitDate}</dd>
              </>
            )}
            <dt>Basic salary</dt>
            <dd>{employee.basicSalary !== undefined ? money(employee.basicSalary) : "-"}</dd>
          </dl>
          {isHr && (
            <div className="hx-actions">
              <button type="button" className="hx-btn" onClick={() => { setMessage(""); setEditing(true); }}>
                Edit employee
              </button>
            </div>
          )}
        </div>
      )}

      {employee.login && (
        <div className="hx-card">
          <h2>Login</h2>
          <p style={{ marginTop: 0 }}>
            <Badge tone={employee.login.isActive ? "green" : "red"}>{employee.login.isActive ? "Active" : "Deactivated"}</Badge>{" "}
            {employee.login.mustChangePassword && <Badge tone="amber">Has not changed the temporary password</Badge>}
          </p>
          {isAdmin && (
            <div className="hx-actions">
              <button type="button" className="hx-btn hx-light" disabled={busy} onClick={toggleLogin}>
                {employee.login.isActive ? "Deactivate login" : "Activate login"}
              </button>
              <button type="button" className="hx-btn hx-light" disabled={busy} onClick={resetPassword}>
                Reset password
              </button>
            </div>
          )}
          {!isAdmin && <p style={{ color: "#64708a", marginBottom: 0 }}>Only the Admin can switch a login on or off or reset its password.</p>}
        </div>
      )}

      <Link href="/employees">Back to employees</Link>
    </>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <RequireRole roles={["admin", "hr"]}>
      <PageHeader title="Employee" subtitle="Full profile (Employee 360)" />
      <EmployeeDetail id={params.id} />
    </RequireRole>
  );
}
