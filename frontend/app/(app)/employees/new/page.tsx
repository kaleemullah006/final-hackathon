"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Alert, Loading, PageHeader, RequireRole, TempPasswordBox, errorText } from "@/components/ui";
import EmployeeForm, { type Employee, type Option } from "@/components/EmployeeForm";

type Created = { employee: Employee; login: { email: string; tempPassword: string } };

function Register() {
  const [departments, setDepartments] = useState<Option[] | null>(null);
  const [designations, setDesignations] = useState<Option[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    async function load() {
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

    load();
  }, []);

  const submit = async (body: Record<string, unknown>) => {
    setError("");
    setSaving(true);
    try {
      const result = await apiFetch<Created>("/employees", { method: "POST", auth: true, body });
      setCreated(result);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  if (!departments || !designations) {
    return error ? <Alert kind="error">{error}</Alert> : <Loading />;
  }

  if (departments.length === 0 || designations.length === 0) {
    return (
      <Alert kind="info">
        An active department and an active designation are needed first. Ask the Admin to add them under
        Organization.
      </Alert>
    );
  }

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}

      {created && (
        <>
          <Alert kind="success">
            Registered {created.employee.name} with code {created.employee.code}.
          </Alert>
          <TempPasswordBox
            title="Login created"
            email={created.login.email}
            password={created.login.tempPassword}
            onClose={() => setCreated(null)}
          />
          <div className="hx-actions" style={{ marginBottom: 16 }}>
            <Link href={`/employees/${created.employee.id}`} className="hx-btn">
              View employee
            </Link>
            <button
              type="button"
              className="hx-btn hx-light"
              onClick={() => {
                setCreated(null);
                setFormKey((key) => key + 1);
              }}
            >
              Register another
            </button>
          </div>
        </>
      )}

      {!created && (
        <div className="hx-card">
          <EmployeeForm
            key={formKey}
            initial={null}
            departments={departments}
            designations={designations}
            submitting={saving}
            submitLabel="Register employee"
            onSubmit={submit}
          />
        </div>
      )}
    </>
  );
}

export default function RegisterEmployeePage() {
  return (
    <RequireRole roles={["hr"]}>
      <PageHeader title="Register employee" subtitle="This also creates the employee's login with a temporary password" />
      <Register />
    </RequireRole>
  );
}
