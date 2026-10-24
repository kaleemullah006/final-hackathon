const Company = require("../models/company");
const AppError = require("../utils/appError");
const { requireString } = require("../utils/validators");
const { logAudit } = require("../utils/audit");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNumberInRange(value, field, min, max, { integer = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AppError(422, `${field} must be a number`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new AppError(422, `${field} must be a whole number`);
  }
  if (value < min || value > max) {
    throw new AppError(422, `${field} must be between ${min} and ${max}`);
  }
  return value;
}

// Turns a Company document into the plain object the API returns
function toSettings(company) {
  const location = company.officeLocation || {};
  return {
    name: company.name,
    officeStartTime: company.officeStartTime,
    graceMinutes: company.graceMinutes,
    halfDayHours: company.halfDayHours,
    weekendDays: [...(company.weekendDays || [])],
    officeLocation: {
      lat: location.lat ?? null,
      lng: location.lng ?? null,
      radiusMeters: location.radiusMeters ?? 150,
    },
  };
}

// Pure function (no database): checks the request body and returns only the
// validated fields to change. `current` is the settings object from toSettings().
function validateSettingsUpdate(body, current) {
  if (!isPlainObject(body)) {
    throw new AppError(422, "Request body must be a JSON object");
  }

  const updates = {};

  if (body.name !== undefined) {
    updates.name = requireString(body.name, "Company name");
  }

  if (body.officeStartTime !== undefined) {
    if (typeof body.officeStartTime !== "string" || !TIME_RE.test(body.officeStartTime)) {
      throw new AppError(422, "Office start time must be in HH:MM format (24 hour)");
    }
    updates.officeStartTime = body.officeStartTime;
  }

  if (body.graceMinutes !== undefined) {
    updates.graceMinutes = requireNumberInRange(body.graceMinutes, "Grace minutes", 0, 120, {
      integer: true,
    });
  }

  if (body.halfDayHours !== undefined) {
    updates.halfDayHours = requireNumberInRange(body.halfDayHours, "Half day hours", 1, 12);
  }

  if (body.weekendDays !== undefined) {
    if (!Array.isArray(body.weekendDays) || body.weekendDays.length > 6) {
      throw new AppError(422, "Weekend days must be a list of at most 6 days");
    }
    const days = body.weekendDays.map((day) =>
      requireNumberInRange(day, "Weekend day", 0, 6, { integer: true })
    );
    if (new Set(days).size !== days.length) {
      throw new AppError(422, "Weekend days must not repeat");
    }
    updates.weekendDays = days.sort((a, b) => a - b);
  }

  if (body.officeLocation !== undefined) {
    const input = body.officeLocation;
    if (!isPlainObject(input)) {
      throw new AppError(422, "Office location must be an object");
    }

    const merged = { ...current.officeLocation };

    if ("lat" in input) {
      merged.lat = input.lat === null ? null : requireNumberInRange(input.lat, "Latitude", -90, 90);
    }
    if ("lng" in input) {
      merged.lng = input.lng === null ? null : requireNumberInRange(input.lng, "Longitude", -180, 180);
    }
    if ("radiusMeters" in input) {
      merged.radiusMeters = requireNumberInRange(input.radiusMeters, "Radius", 10, 5000);
    }

    if ((merged.lat === null) !== (merged.lng === null)) {
      throw new AppError(422, "Latitude and longitude must be set together");
    }

    updates.officeLocation = merged;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(422, "No valid settings were sent to update");
  }

  return updates;
}

async function getSettingsService() {
  const company = await Company.findOne();
  if (!company) {
    throw new AppError(404, "Company is not set up yet");
  }
  return toSettings(company);
}

async function updateSettingsService(actor, body) {
  const company = await Company.findOne();
  if (!company) {
    throw new AppError(404, "Company is not set up yet");
  }

  const before = toSettings(company);
  const updates = validateSettingsUpdate(body, before);

  // Keep only the fields whose value really changed
  const changedKeys = Object.keys(updates).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(updates[key])
  );

  if (changedKeys.length === 0) {
    return before;
  }

  company.set(updates);
  await company.save();

  const after = toSettings(company);
  const pick = (source) => Object.fromEntries(changedKeys.map((key) => [key, source[key]]));

  await logAudit({
    actor,
    action: "settings.update",
    entity: "company",
    entityId: company._id,
    before: pick(before),
    after: pick(after),
  });

  return after;
}

module.exports = { getSettingsService, updateSettingsService, validateSettingsUpdate, toSettings };
