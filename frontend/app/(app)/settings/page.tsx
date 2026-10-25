"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Alert, Field, Loading, PageHeader, RequireRole, errorText } from "@/components/ui";

type Settings = {
  name: string;
  officeStartTime: string;
  graceMinutes: number;
  halfDayHours: number;
  weekendDays: number[];
  officeLocation: { lat: number | null; lng: number | null; radiusMeters: number };
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SettingsForm() {
  const user = useSession();
  const canEdit = user.role === "admin";

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState("09:00");
  const [grace, setGrace] = useState("15");
  const [halfDay, setHalfDay] = useState("5");
  const [weekend, setWeekend] = useState<number[]>([]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("150");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const fill = (s: Settings) => {
    setName(s.name);
    setStart(s.officeStartTime);
    setGrace(String(s.graceMinutes));
    setHalfDay(String(s.halfDayHours));
    setWeekend(s.weekendDays);
    setLat(s.officeLocation.lat === null ? "" : String(s.officeLocation.lat));
    setLng(s.officeLocation.lng === null ? "" : String(s.officeLocation.lng));
    setRadius(String(s.officeLocation.radiusMeters));
  };

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<{ settings: Settings }>("/settings", { auth: true });
        fill(data.settings);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoaded(true);
      }
    }

    load();
  }, []);

  const toggleDay = (day: number) => {
    setWeekend((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));
  };

  const useMyLocation = () => {
    setError("");
    if (!navigator.geolocation) {
      setError("This browser cannot read your location. Type the numbers instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
      },
      () => setError("Could not read your location. Allow location access or type the numbers."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const latBlank = lat.trim() === "";
    const lngBlank = lng.trim() === "";
    if (latBlank !== lngBlank) {
      setError("Set both latitude and longitude, or leave both empty.");
      return;
    }

    setSaving(true);
    try {
      const data = await apiFetch<{ settings: Settings }>("/settings", {
        method: "PUT",
        auth: true,
        body: {
          name,
          officeStartTime: start,
          graceMinutes: Number(grace),
          halfDayHours: Number(halfDay),
          weekendDays: weekend,
          officeLocation: {
            lat: latBlank ? null : Number(lat),
            lng: lngBlank ? null : Number(lng),
            radiusMeters: Number(radius),
          },
        },
      });
      fill(data.settings);
      setMessage("Settings saved.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <Loading />;

  return (
    <form className="hx-card" onSubmit={save}>
      {error && <Alert kind="error">{error}</Alert>}
      {message && <Alert kind="success">{message}</Alert>}
      {!canEdit && <Alert kind="info">You can view the settings. Only the Admin can change them.</Alert>}

      <div className="hx-form-grid">
        <Field label="Company name" htmlFor="name">
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
        </Field>
        <Field label="Office start time" htmlFor="start">
          <input id="start" type="time" value={start} onChange={(e) => setStart(e.target.value)} disabled={!canEdit} required />
        </Field>
        <Field label="Grace time (minutes)" htmlFor="grace" hint="Check-in after start + grace counts as late">
          <input id="grace" type="number" min={0} max={120} value={grace} onChange={(e) => setGrace(e.target.value)} disabled={!canEdit} required />
        </Field>
        <Field label="Half day under (hours)" htmlFor="half">
          <input id="half" type="number" min={1} max={12} step="0.5" value={halfDay} onChange={(e) => setHalfDay(e.target.value)} disabled={!canEdit} required />
        </Field>
      </div>

      <h2 style={{ marginTop: 20 }}>Weekend</h2>
      <div className="hx-checks">
        {DAYS.map((label, day) => (
          <label key={day}>
            <input type="checkbox" checked={weekend.includes(day)} onChange={() => toggleDay(day)} disabled={!canEdit} />
            {label}
          </label>
        ))}
      </div>

      <h2 style={{ marginTop: 20 }}>Office location (for camera attendance)</h2>
      <div className="hx-form-grid">
        <Field label="Latitude" htmlFor="lat">
          <input id="lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} disabled={!canEdit} />
        </Field>
        <Field label="Longitude" htmlFor="lng">
          <input id="lng" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} disabled={!canEdit} />
        </Field>
        <Field label="Radius (meters)" htmlFor="radius" hint="10 to 5000">
          <input id="radius" type="number" min={10} max={5000} value={radius} onChange={(e) => setRadius(e.target.value)} disabled={!canEdit} required />
        </Field>
      </div>

      {canEdit && (
        <div className="hx-actions">
          <button type="submit" className="hx-btn" disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </button>
          <button type="button" className="hx-btn hx-light" onClick={useMyLocation}>
            Use my current location
          </button>
        </div>
      )}
    </form>
  );
}

export default function SettingsPage() {
  return (
    <RequireRole roles={["admin", "hr"]}>
      <PageHeader title="Company settings" subtitle="Office hours, grace time, weekend and office location" />
      <SettingsForm />
    </RequireRole>
  );
}
