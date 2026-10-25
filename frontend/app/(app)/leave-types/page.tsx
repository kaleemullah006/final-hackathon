"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Alert, Badge, Empty, Field, Loading, PageHeader, RequireRole, errorText } from "@/components/ui";

type LeaveType = { id: string; name: string; yearlyQuota: number | null; isPaid: boolean; isActive: boolean };

function LeaveTypes() {
  const user = useSession();
  const canEdit = user.role === "admin";

  const [items, setItems] = useState<LeaveType[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [quota, setQuota] = useState("");
  const [isPaid, setIsPaid] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuota, setEditQuota] = useState("");
  const [editPaid, setEditPaid] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch<{ leaveTypes: LeaveType[] }>("/leave-types", { auth: true });
        if (!cancelled) setItems(data.leaveTypes);
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const run = async (action: () => Promise<string | void>, success: string) => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const custom = await action();
      setMessage(custom || success);
      setReloadKey((key) => key + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Blank quota means unlimited (null)
  const quotaValue = (text: string) => (text.trim() === "" ? null : Number(text));

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await run(async () => {
      await apiFetch("/leave-types", {
        method: "POST",
        auth: true,
        body: { name, yearlyQuota: quotaValue(quota), isPaid },
      });
      setName("");
      setQuota("");
      setIsPaid(true);
    }, "Leave type added.");
  };

  const addStandard = async () => {
    await run(async () => {
      const result = await apiFetch<{ created: unknown[]; skipped: string[] }>("/leave-types/standard", {
        method: "POST",
        auth: true,
      });
      return `Added ${result.created.length} standard leave type(s)` +
        (result.skipped.length ? `, skipped (already there): ${result.skipped.join(", ")}.` : ".");
    }, "Done.");
  };

  const startEdit = (item: LeaveType) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditQuota(item.yearlyQuota === null ? "" : String(item.yearlyQuota));
    setEditPaid(item.isPaid);
  };

  const saveEdit = async (id: string) => {
    await run(async () => {
      await apiFetch(`/leave-types/${id}`, {
        method: "PATCH",
        auth: true,
        body: { name: editName, yearlyQuota: quotaValue(editQuota), isPaid: editPaid },
      });
      setEditId(null);
    }, "Saved.");
  };

  const setActive = async (id: string, isActive: boolean) => {
    await run(async () => {
      await apiFetch(`/leave-types/${id}`, { method: "PATCH", auth: true, body: { isActive } });
    }, isActive ? "Activated." : "Deactivated.");
  };

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}
      {!canEdit && <Alert kind="info">You can view the leave types. Only the Admin can change them.</Alert>}

      {canEdit && (
        <form className="hx-card" onSubmit={add}>
          <div className="hx-inline">
            <Field label="Name" htmlFor="lt-name">
              <input id="lt-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
            </Field>
            <Field label="Yearly quota (days)" htmlFor="lt-quota" hint="Leave empty for unlimited">
              <input id="lt-quota" type="number" min={0} max={365} value={quota} onChange={(e) => setQuota(e.target.value)} />
            </Field>
            <label style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 10 }}>
              <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} /> Paid
            </label>
            <button type="submit" className="hx-btn" disabled={busy}>
              Add leave type
            </button>
          </div>
          <div className="hx-actions">
            <button type="button" className="hx-btn hx-light" disabled={busy} onClick={addStandard}>
              Add standard types (Annual 14, Sick 8, Casual 10, Unpaid)
            </button>
          </div>
        </form>
      )}

      <div className="hx-card">
        {!items && !error && <Loading />}
        {items && items.length === 0 && <Empty>No leave types yet.</Empty>}
        {items && items.length > 0 && (
          <div className="hx-table-wrap">
            <table className="hx-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Yearly quota</th>
                  <th>Paid</th>
                  <th>Status</th>
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
                          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Leave type name" maxLength={100} />
                        ) : (
                          item.name
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input type="number" min={0} max={365} value={editQuota} onChange={(e) => setEditQuota(e.target.value)} placeholder="Unlimited" aria-label="Yearly quota" />
                        ) : item.yearlyQuota === null ? (
                          "Unlimited"
                        ) : (
                          `${item.yearlyQuota} days`
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input type="checkbox" checked={editPaid} onChange={(e) => setEditPaid(e.target.checked)} aria-label="Paid" />
                        ) : item.isPaid ? (
                          "Paid"
                        ) : (
                          "Unpaid"
                        )}
                      </td>
                      <td>
                        <Badge tone={item.isActive ? "green" : undefined}>{item.isActive ? "Active" : "Inactive"}</Badge>
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
                                <button type="button" className="hx-btn hx-light hx-small" onClick={() => startEdit(item)}>
                                  Edit
                                </button>
                                <button type="button" className="hx-btn hx-light hx-small" disabled={busy} onClick={() => setActive(item.id, !item.isActive)}>
                                  {item.isActive ? "Deactivate" : "Activate"}
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

export default function LeaveTypesPage() {
  return (
    <RequireRole roles={["admin", "hr"]}>
      <PageHeader title="Leave types" subtitle="Yearly quotas used when employees apply for leave" />
      <LeaveTypes />
    </RequireRole>
  );
}
