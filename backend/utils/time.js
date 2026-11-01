// All office times use Pakistan time (UTC+5, no daylight saving).
// Vercel servers run in UTC, so this is done by hand instead of trusting the server clock zone.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, "0");

function pktParts(date) {
  const d = new Date(date.getTime() + PKT_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

// "YYYY-MM-DD" in Pakistan time
function dateStringPk(date = new Date()) {
  const p = pktParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function secondsOfDayPk(date) {
  const p = pktParts(date);
  return p.hour * 3600 + p.minute * 60 + p.second;
}

// "HH:mm" in Pakistan time
function timeStringPk(date) {
  const p = pktParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

const parseDateString = (dateString) => new Date(`${dateString}T00:00:00Z`);

function dayOfWeek(dateString) {
  return parseDateString(dateString).getUTCDay(); // 0 = Sunday ... 6 = Saturday
}

function addDays(dateString, amount) {
  const d = parseDateString(dateString);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

// Every date from "from" to "to", both included (limited so a mistake can never loop for ever)
function eachDate(from, to, limit = 400) {
  const dates = [];
  let current = from;
  while (current <= to && dates.length < limit) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// "2026-10" -> { from: "2026-10-01", to: "2026-10-31" }
function monthRange(month) {
  if (typeof month !== "string" || !MONTH_RE.test(month)) return null;
  const [year, mon] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
}

// "09:15" on "2026-10-05" in Pakistan time -> a real Date
function timeOnDatePk(dateString, hm) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute] = hm.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - PKT_OFFSET_MS);
}

const minutesFromHm = (hm) => {
  const [hour, minute] = hm.split(":").map(Number);
  return hour * 60 + minute;
};

module.exports = {
  dateStringPk,
  secondsOfDayPk,
  timeStringPk,
  dayOfWeek,
  addDays,
  eachDate,
  monthRange,
  timeOnDatePk,
  minutesFromHm,
  TIME_RE,
};
