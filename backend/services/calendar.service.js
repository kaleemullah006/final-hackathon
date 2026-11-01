const Company = require("../models/company");
const Holiday = require("../models/holiday");
const { dayOfWeek, eachDate } = require("../utils/time");

const DEFAULTS = { officeStartTime: "09:00", graceMinutes: 15, halfDayHours: 5, weekendDays: [0, 6] };

// The company rules plus the public holidays between two dates, loaded once per request
async function loadCalendar(from, to) {
  const [company, holidays] = await Promise.all([
    Company.findOne(),
    Holiday.find({ date: { $gte: from, $lte: to } }),
  ]);

  const settings = {
    officeStartTime: company?.officeStartTime || DEFAULTS.officeStartTime,
    graceMinutes: company?.graceMinutes ?? DEFAULTS.graceMinutes,
    halfDayHours: company?.halfDayHours ?? DEFAULTS.halfDayHours,
    weekendDays: company?.weekendDays || DEFAULTS.weekendDays,
  };

  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]));
  return { settings, holidayMap };
}

const isWeekend = (date, calendar) => calendar.settings.weekendDays.includes(dayOfWeek(date));
const holidayName = (date, calendar) => calendar.holidayMap.get(date) || null;
const isWorkingDay = (date, calendar) => !isWeekend(date, calendar) && !holidayName(date, calendar);

// Counts only working days: weekends and public holidays are skipped
function countWorkingDays(start, end, calendar) {
  return eachDate(start, end).filter((date) => isWorkingDay(date, calendar)).length;
}

module.exports = { loadCalendar, isWeekend, holidayName, isWorkingDay, countWorkingDays };
