"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Alert, Badge, Loading, PageHeader, errorText } from "@/components/ui";

type Counts = {
  departments: number;
  designations: number;
  leaveTypes: number;
  holidays: number;
  employees: number;
  hrLogins: number | null;
};

type MyEmployee = {
  code: string;
  name: string;
  department: { name: string | null };
  designation: { name: string | null };
  status: string;
  joiningDate: string;
};

function StaffDashboard() {
  const user = useSession();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [departments, designations, leaveTypes, holidays, employees, hr] = await Promise.all([
          apiFetch<{ departments: unknown[] }>("/departments?active=true", { auth: true }),
          apiFetch<{ designations: unknown[] }>("/designations?active=true", { auth: true }),
          apiFetch<{ leaveTypes: unknown[] }>("/leave-types?active=true", { auth: true }),
          apiFetch<{ holidays: unknown[] }>("/holidays", { auth: true }),
          apiFetch<{ total: number }>("/employees?limit=1", { auth: true }),
          user.role === "admin"
            ? apiFetch<{ users: unknown[] }>("/users?role=hr", { auth: true })
            : Promise.resolve(null),
        ]);

        setCounts({
          departments: departments.departments.length,
          designations: designations.designations.length,
          leaveTypes: leaveTypes.leaveTypes.length,
          holidays: holidays.holidays.length,
          employees: employees.total,
          hrLogins: hr ? hr.users.length : null,
        });
      } catch (e) {
        setError(errorText(e));
      }
    }

    load();
  }, [user.role]);

  const cards = counts
    ? [
        { href: "/employees", label: "Employees", value: counts.employees },
        { href: "/departments", label: "Active departments", value: counts.departments },
        { href: "/designations", label: "Active designations", value: counts.designations },
        { href: "/leave-types", label: "Active leave types", value: counts.leaveTypes },
        { href: "/holidays", label: "Public holidays", value: counts.holidays },
        ...(counts.hrLogins !== null ? [{ href: "/users", label: "HR logins", value: counts.hrLogins }] : []),
      ]
    : [];

  const next =
    counts && user.role === "admin"
      ? counts.departments === 0
        ? { href: "/departments", text: "Add your first department" }
        : counts.designations === 0
          ? { href: "/designations", text: "Add your first designation" }
          : counts.leaveTypes === 0
            ? { href: "/leave-types", text: "Add the leave types" }
            : counts.hrLogins === 0
              ? { href: "/users", text: "Create an HR login" }
              : null
      : null;

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}
      {!counts && !error && <Loading />}
      {next && (
        <Alert kind="info">
          Next step for setup: <Link href={next.href}>{next.text}</Link>
        </Alert>
      )}
      {counts && counts.departments === 0 && user.role === "hr" && (
        <Alert kind="info">No departments yet. Ask the Admin to add departments before registering employees.</Alert>
      )}
      <div className="hx-grid">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="hx-stat">
            <b>{card.value}</b>
            <span>{card.label}</span>
          </Link>
        ))}
      </div>
      <p style={{ color: "#64708a", marginTop: 16 }}>
        These numbers come straight from the records saved in the system. Attendance, leave and payroll
        dashboards will appear here when those modules are added.
      </p>
    </>
  );
}

function EmployeeDashboard() {
  const [me, setMe] = useState<MyEmployee | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<{ employee: MyEmployee }>("/employees/me", { auth: true });
        setMe(data.employee);
      } catch (e) {
        setError(errorText(e));
      }
    }

    load();
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!me) return <Loading />;

  return (
    <div className="hx-card">
      <h2>Your details</h2>
      <dl className="hx-kv">
        <dt>Employee code</dt>
        <dd>{me.code}</dd>
        <dt>Department</dt>
        <dd>{me.department.name}</dd>
        <dt>Designation</dt>
        <dd>{me.designation.name}</dd>
        <dt>Status</dt>
        <dd>
          <Badge tone={me.status === "exited" ? undefined : "green"}>{me.status}</Badge>
        </dd>
        <dt>Joined</dt>
        <dd>{me.joiningDate}</dd>
      </dl>
      <div className="hx-actions">
        <Link href="/my-profile" className="hx-btn">
          Open my profile
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useSession();
  const roleLabel = user.role === "hr" ? "HR" : user.role === "admin" ? "Admin" : "Employee";

  return (
    <>
      <PageHeader title={`Welcome, ${user.name}`} subtitle={`${roleLabel} dashboard`} />
      {user.role === "employee" ? <EmployeeDashboard /> : <StaffDashboard />}
    </>
  );
}
