"use client";

import { useState } from "react";
import { Field } from "@/components/ui";

export type Option = { id: string; name: string };

export type Employee = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gender: "male" | "female" | "other";
  department: { id: string; name: string | null };
  designation: { id: string; name: string | null };
  joiningDate: string;
  status: "probation" | "active" | "exited";
  exitDate: string | null;
  basicSalary?: number;
  userId?: string;
  login?: { isActive: boolean; mustChangePassword: boolean } | null;
};

type Values = {
  name: string;
  email: string;
  gender: string;
  phone: string;
  address: string;
  department: string;
  designation: string;
  joiningDate: string;
  basicSalary: string;
  status: string;
  exitDate: string;
  code: string;
};

function valuesFrom(employee: Employee | null): Values {
  return {
    name: employee?.name ?? "",
    email: employee?.email ?? "",
    gender: employee?.gender ?? "",
    phone: employee?.phone ?? "",
    address: employee?.address ?? "",
    department: employee?.department.id ?? "",
    designation: employee?.designation.id ?? "",
    joiningDate: employee?.joiningDate ?? "",
    basicSalary: employee?.basicSalary !== undefined ? String(employee.basicSalary) : "",
    status: employee?.status ?? "probation",
    exitDate: employee?.exitDate ?? "",
    code: employee?.code ?? "",
  };
}

type Built = { body: Record<string, unknown> } | { error: string };

// Turns the form into the request body. In edit mode only the changed fields are sent.
function buildBody(values: Values, initial: Employee | null): Built {
  const salary = Number(values.basicSalary);
  if (values.basicSalary.trim() === "" || !Number.isFinite(salary) || salary <= 0) {
    return { error: "Basic salary must be a number greater than 0." };
  }

  if (!initial) {
    const body: Record<string, unknown> = {
      name: values.name,
      email: values.email,
      gender: values.gender,
      department: values.department,
      designation: values.designation,
      joiningDate: values.joiningDate,
      basicSalary: salary,
      status: values.status,
    };
    if (values.code.trim()) body.code = values.code.trim();
    if (values.phone.trim()) body.phone = values.phone.trim();
    if (values.address.trim()) body.address = values.address.trim();
    return { body };
  }

  const before = valuesFrom(initial);
  const body: Record<string, unknown> = {};
  const changed = (key: keyof Values) => values[key].trim() !== before[key].trim();

  for (const key of ["name", "email", "gender", "department", "designation", "joiningDate", "status", "code"] as const) {
    if (changed(key)) body[key] = values[key].trim();
  }
  // A phone or address cannot be cleared here, only changed to a new value
  for (const key of ["phone", "address"] as const) {
    if (changed(key) && values[key].trim()) body[key] = values[key].trim();
  }
  if (salary !== initial.basicSalary) body.basicSalary = salary;

  if (values.status === "exited") {
    if (!values.exitDate) return { error: "Exit date is required when the status is exited." };
    if (changed("exitDate") || changed("status")) body.exitDate = values.exitDate;
  }

  if (Object.keys(body).length === 0) return { error: "Nothing to save: no field was changed." };
  return { body };
}

export default function EmployeeForm({
  initial,
  departments,
  designations,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Employee | null;
  departments: Option[];
  designations: Option[];
  submitting: boolean;
  submitLabel: string;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Values>(() => valuesFrom(initial));
  const [error, setError] = useState("");

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues((current) => ({ ...current, [key]: e.target.value }));
  };

  // The employee's current department stays selectable even if it was deactivated later
  const withCurrent = (list: Option[], current: { id: string; name: string | null } | undefined) =>
    current && !list.some((item) => item.id === current.id)
      ? [...list, { id: current.id, name: `${current.name ?? "Unknown"} (inactive)` }]
      : list;

  const departmentOptions = withCurrent(departments, initial?.department);
  const designationOptions = withCurrent(designations, initial?.designation);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const built = buildBody(values, initial);
    if ("error" in built) {
      setError(built.error);
      return;
    }
    onSubmit(built.body);
  };

  return (
    <form onSubmit={submit}>
      {error && (
        <div className="hx-alert hx-error" role="alert">
          {error}
        </div>
      )}

      <div className="hx-form-grid">
        <Field label="Full name" htmlFor="f-name">
          <input id="f-name" type="text" value={values.name} onChange={set("name")} maxLength={100} required />
        </Field>
        <Field label="Email (also the login)" htmlFor="f-email">
          <input id="f-email" type="email" value={values.email} onChange={set("email")} required />
        </Field>
        <Field label="Gender" htmlFor="f-gender">
          <select id="f-gender" value={values.gender} onChange={set("gender")} required>
            <option value="">Select...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Phone" htmlFor="f-phone" hint="Optional. Digits, + - ( ) and spaces">
          <input id="f-phone" type="text" value={values.phone} onChange={set("phone")} maxLength={20} />
        </Field>
        <Field label="Department" htmlFor="f-dept">
          <select id="f-dept" value={values.department} onChange={set("department")} required>
            <option value="">Select...</option>
            {departmentOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Designation" htmlFor="f-desig">
          <select id="f-desig" value={values.designation} onChange={set("designation")} required>
            <option value="">Select...</option>
            {designationOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Joining date" htmlFor="f-join">
          <input id="f-join" type="date" value={values.joiningDate} onChange={set("joiningDate")} required />
        </Field>
        <Field label="Basic salary" htmlFor="f-salary">
          <input id="f-salary" type="number" min={1} step="any" value={values.basicSalary} onChange={set("basicSalary")} required />
        </Field>
        <Field label="Status" htmlFor="f-status">
          <select id="f-status" value={values.status} onChange={set("status")}>
            <option value="probation">Probation</option>
            <option value="active">Active</option>
            {initial && <option value="exited">Exited</option>}
          </select>
        </Field>
        {values.status === "exited" && (
          <Field label="Exit date" htmlFor="f-exit" hint="The login is switched off when you save">
            <input id="f-exit" type="date" value={values.exitDate} onChange={set("exitDate")} required />
          </Field>
        )}
        <Field label="Employee code" htmlFor="f-code" hint={initial ? undefined : "Leave empty for an automatic code (EMP-0001...)"}>
          <input id="f-code" type="text" value={values.code} onChange={set("code")} maxLength={20} />
        </Field>
      </div>

      <div className="hx-field" style={{ marginTop: 14 }}>
        <label htmlFor="f-address">Address</label>
        <textarea id="f-address" rows={2} value={values.address} onChange={set("address")} maxLength={300} />
      </div>

      <div className="hx-actions">
        <button type="submit" className="hx-btn" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="hx-btn hx-light" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
