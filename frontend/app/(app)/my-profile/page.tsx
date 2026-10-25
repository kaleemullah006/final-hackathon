"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Alert, Badge, Field, Loading, PageHeader, RequireRole, errorText } from "@/components/ui";
import type { Employee } from "@/components/EmployeeForm";

function MyProfile() {
  const [me, setMe] = useState<Employee | null>(null);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const fill = (employee: Employee) => {
    setMe(employee);
    setPhone(employee.phone);
    setAddress(employee.address);
  };

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<{ employee: Employee }>("/employees/me", { auth: true });
        fill(data.employee);
      } catch (e) {
        setError(errorText(e));
      }
    }

    load();
  }, []);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!me) return;
    setError("");
    setMessage("");

    // Only phone and address can be changed, and only changed values are sent
    const body: Record<string, string> = {};
    if (phone.trim() && phone.trim() !== me.phone) body.phone = phone.trim();
    if (address.trim() && address.trim() !== me.address) body.address = address.trim();
    if (Object.keys(body).length === 0) {
      setError("Nothing to save: change your phone or address first.");
      return;
    }

    setSaving(true);
    try {
      const data = await apiFetch<{ employee: Employee }>("/employees/me", { method: "PATCH", auth: true, body });
      fill(data.employee);
      setMessage("Saved.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  if (!me) {
    return error ? <Alert kind="error">{error}</Alert> : <Loading />;
  }

  return (
    <>
      <div className="hx-card">
        <h2>
          {me.name} <Badge tone={me.status === "exited" ? undefined : "green"}>{me.status}</Badge>
        </h2>
        <dl className="hx-kv">
          <dt>Employee code</dt>
          <dd>{me.code}</dd>
          <dt>Email</dt>
          <dd>{me.email}</dd>
          <dt>Department</dt>
          <dd>{me.department.name}</dd>
          <dt>Designation</dt>
          <dd>{me.designation.name}</dd>
          <dt>Joining date</dt>
          <dd>{me.joiningDate}</dd>
        </dl>
      </div>

      <form className="hx-card" onSubmit={save}>
        <h2>Contact details</h2>
        <p style={{ marginTop: 0, color: "#64708a" }}>You can change your phone and address. HR manages the rest.</p>
        {error && <Alert kind="error">{error}</Alert>}
        {message && <Alert kind="success">{message}</Alert>}
        <div className="hx-form-grid">
          <Field label="Phone" htmlFor="m-phone" hint="Digits, + - ( ) and spaces">
            <input id="m-phone" type="text" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
          </Field>
        </div>
        <div className="hx-field" style={{ marginTop: 14 }}>
          <label htmlFor="m-address">Address</label>
          <textarea id="m-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
        </div>
        <div className="hx-actions">
          <button type="submit" className="hx-btn" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </>
  );
}

export default function MyProfilePage() {
  return (
    <RequireRole roles={["employee"]}>
      <PageHeader title="My profile" subtitle="Your details" />
      <MyProfile />
    </RequireRole>
  );
}
