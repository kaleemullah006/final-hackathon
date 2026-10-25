"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Alert, Badge, Empty, Field, Loading, PageHeader, RequireRole, errorText } from "@/components/ui";
import type { Employee, Option } from "@/components/EmployeeForm";

type ListResult = { employees: Employee[]; page: number; limit: number; total: number; totalPages: number };

function EmployeeList() {
  const router = useRouter();
  const user = useSession();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [departments, setDepartments] = useState<Option[]>([]);
  const [designations, setDesignations] = useState<Option[]>([]);
  const [result, setResult] = useState<ListResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOptions() {
      try {
        const [d, g] = await Promise.all([
          apiFetch<{ departments: Option[] }>("/departments", { auth: true }),
          apiFetch<{ designations: Option[] }>("/designations", { auth: true }),
        ]);
        setDepartments(d.departments);
        setDesignations(g.designations);
      } catch (e) {
        setError(errorText(e));
      }
    }

    loadOptions();
  }, []);

  // Wait until the person stops typing before asking the server
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (debounced) params.set("search", debounced);
      if (department) params.set("department", department);
      if (designation) params.set("designation", designation);
      if (status) params.set("status", status);

      try {
        const data = await apiFetch<ListResult>(`/employees?${params.toString()}`, { auth: true });
        if (!cancelled) {
          setResult(data);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [debounced, department, designation, status, page]);

  const filter = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const filtersUsed = Boolean(debounced || department || designation || status);

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}

      <div className="hx-card">
        <div className="hx-inline">
          <Field label="Search" htmlFor="e-search">
            <input id="e-search" type="search" placeholder="Name, email or code" value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
          <Field label="Department" htmlFor="e-dept">
            <select id="e-dept" value={department} onChange={filter(setDepartment)}>
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Designation" htmlFor="e-desig">
            <select id="e-desig" value={designation} onChange={filter(setDesignation)}>
              <option value="">All</option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" htmlFor="e-status">
            <select id="e-status" value={status} onChange={filter(setStatus)}>
              <option value="">All</option>
              <option value="probation">Probation</option>
              <option value="active">Active</option>
              <option value="exited">Exited</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="hx-card">
        {!result && !error && <Loading />}
        {result && result.employees.length === 0 && (
          <Empty>
            {filtersUsed
              ? "No employees match these filters."
              : user.role === "hr"
                ? "No employees yet. Register the first one."
                : "No employees yet. HR registers employees."}
          </Empty>
        )}
        {result && result.employees.length > 0 && (
          <>
            <div className="hx-table-wrap">
              <table className="hx-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Joined</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.employees.map((e) => (
                    <tr key={e.id} className="hx-click" onClick={() => router.push(`/employees/${e.id}`)}>
                      <td>{e.code}</td>
                      <td>
                        <Link href={`/employees/${e.id}`}>{e.name}</Link>
                        <div style={{ color: "#64708a", fontSize: 12 }}>{e.email}</div>
                      </td>
                      <td>{e.department.name}</td>
                      <td>{e.designation.name}</td>
                      <td>{e.joiningDate}</td>
                      <td>
                        <Badge tone={e.status === "active" ? "green" : e.status === "probation" ? "amber" : undefined}>{e.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="hx-pager">
              <span>
                {result.total} employee(s), page {result.page} of {result.totalPages}
              </span>
              <button type="button" className="hx-btn hx-light hx-small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <button type="button" className="hx-btn hx-light hx-small" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function EmployeesPage() {
  const user = useSession();

  return (
    <RequireRole roles={["admin", "hr"]}>
      <PageHeader
        title="Employees"
        subtitle="Search, filter and open an employee"
        actions={
          user.role === "hr" ? (
            <Link href="/employees/new" className="hx-btn">
              Register employee
            </Link>
          ) : undefined
        }
      />
      <EmployeeList />
    </RequireRole>
  );
}
