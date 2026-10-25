"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Alert, Empty, Field, Loading, PageHeader, RequireRole, errorText } from "@/components/ui";

type Holiday = { id: string; date: string; name: string };

const weekday = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });

function Holidays() {
  const user = useSession();
  const canEdit = user.role === "admin";

  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [items, setItems] = useState<Holiday[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editName, setEditName] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch<{ holidays: Holiday[] }>(`/holidays?year=${year}`, { auth: true });
        if (!cancelled) setItems(data.holidays);
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [year, reloadKey]);

  const run = async (action: () => Promise<void>, success: string) => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await action();
      setMessage(success);
      setReloadKey((key) => key + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await run(async () => {
      await apiFetch("/holidays", { method: "POST", auth: true, body: { date, name } });
      setDate("");
      setName("");
    }, "Holiday added.");
  };

  const saveEdit = async (id: string) => {
    await run(async () => {
      await apiFetch(`/holidays/${id}`, { method: "PATCH", auth: true, body: { date: editDate, name: editName } });
      setEditId(null);
    }, "Saved.");
  };

  const remove = async (item: Holiday) => {
    if (!window.confirm(`Delete "${item.name}" on ${item.date}?`)) return;
    await run(async () => {
      await apiFetch(`/holidays/${item.id}`, { method: "DELETE", auth: true });
    }, "Deleted.");
  };

  const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2];

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}
      {!canEdit && <Alert kind="info">You can view the holidays. Only the Admin can change them.</Alert>}

      {canEdit && (
        <form className="hx-card" onSubmit={add}>
          <div className="hx-inline">
            <Field label="Date" htmlFor="h-date">
              <input id="h-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="Name" htmlFor="h-name">
              <input id="h-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
            </Field>
            <button type="submit" className="hx-btn" disabled={busy}>
              Add holiday
            </button>
          </div>
        </form>
      )}

      <div className="hx-card">
        <div className="hx-inline" style={{ marginBottom: 12 }}>
          <Field label="Year" htmlFor="h-year">
            <select
              id="h-year"
              value={year}
              onChange={(e) => {
                setItems(null);
                setYear(Number(e.target.value));
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {!items && !error && <Loading />}
        {items && items.length === 0 && <Empty>No holidays in {year}.</Empty>}
        {items && items.length > 0 && (
          <div className="hx-table-wrap">
            <table className="hx-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Name</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const editing = editId === item.id;
                  return (
                    <tr key={item.id}>
                      <td>
                        {editing ? (
                          <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} aria-label="Date" />
                        ) : (
                          item.date
                        )}
                      </td>
                      <td>{weekday(editing ? editDate || item.date : item.date)}</td>
                      <td>
                        {editing ? (
                          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Name" maxLength={100} />
                        ) : (
                          item.name
                        )}
                      </td>
                      {canEdit && (
                        <td>
                          <div className="hx-row-actions">
                            {editing ? (
                              <>
                                <button type="button" className="hx-btn hx-small" disabled={busy} onClick={() => saveEdit(item.id)}>
                                  Save
                                </button>
                                <button type="button" className="hx-btn hx-light hx-small" onClick={() => setEditId(null)}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="hx-btn hx-light hx-small"
                                  onClick={() => {
                                    setEditId(item.id);
                                    setEditDate(item.date);
                                    setEditName(item.name);
                                  }}
                                >
                                  Edit
                                </button>
                                <button type="button" className="hx-btn hx-danger hx-small" disabled={busy} onClick={() => remove(item)}>
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
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

export default function HolidaysPage() {
  return (
    <RequireRole roles={["admin", "hr"]}>
      <PageHeader title="Public holidays" subtitle="Holidays are skipped when leave days and working days are counted" />
      <Holidays />
    </RequireRole>
  );
}
