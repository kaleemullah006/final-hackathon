"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Alert, Badge, Empty, Loading, PageHeader, RequireRole, errorText } from "@/components/ui";

type Item = { id: string; name: string; isActive: boolean };

type Props = {
  title: string;
  subtitle: string;
  path: string; // "/departments"
  listKey: string; // "departments"
  noun: string; // "department"
};

function LookupList({ path, listKey, noun }: Props) {
  const user = useSession();
  const canEdit = user.role === "admin";

  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch<Record<string, Item[]>>(path, { auth: true });
        if (!cancelled) setItems(data[listKey]);
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [path, listKey, reloadKey]);

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
      await apiFetch(path, { method: "POST", auth: true, body: { name: newName } });
      setNewName("");
    }, `Added ${noun}.`);
  };

  const saveName = async (id: string) => {
    await run(async () => {
      await apiFetch(`${path}/${id}`, { method: "PATCH", auth: true, body: { name: editName } });
      setEditId(null);
    }, "Saved.");
  };

  const setActive = async (id: string, isActive: boolean) => {
    await run(async () => {
      await apiFetch(`${path}/${id}`, { method: "PATCH", auth: true, body: { isActive } });
    }, isActive ? "Activated." : "Deactivated.");
  };

  return (
    <>
      {error && <Alert kind="error">{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}

      {canEdit && (
        <form className="hx-card" onSubmit={add}>
          <div className="hx-inline">
            <div className="hx-field">
              <label htmlFor="new-name">New {noun} name</label>
              <input id="new-name" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100} required />
            </div>
            <button type="submit" className="hx-btn" disabled={busy}>
              Add {noun}
            </button>
          </div>
        </form>
      )}
      {!canEdit && <Alert kind="info">You can view this list. Only the Admin can change it.</Alert>}

      <div className="hx-card">
        {!items && !error && <Loading />}
        {items && items.length === 0 && <Empty>No {noun}s yet.{canEdit ? ` Add the first one above.` : ""}</Empty>}
        {items && items.length > 0 && (
          <div className="hx-table-wrap">
            <table className="hx-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {editId === item.id ? (
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} aria-label={`Rename ${item.name}`} maxLength={100} />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td>
                      <Badge tone={item.isActive ? "green" : undefined}>{item.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    {canEdit && (
                      <td>
                        <div className="hx-row-actions">
                          {editId === item.id ? (
                            <>
                              <button type="button" className="hx-btn hx-small" disabled={busy} onClick={() => saveName(item.id)}>
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
                                  setEditName(item.name);
                                }}
                              >
                                Rename
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function LookupPage(props: Props) {
  return (
    <RequireRole roles={["admin", "hr"]}>
      <PageHeader title={props.title} subtitle={props.subtitle} />
      <LookupList {...props} />
    </RequireRole>
  );
}
