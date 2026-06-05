import { ensureDayOnWeek, getWeekDates, todayISO } from "./core.js";

export function hasText(...values) {
  return values.some((value) => String(value ?? "").trim());
}

export function hasImages(images) {
  return Array.isArray(images) && images.length > 0;
}

function hasApprovalStamp(approval) {
  return Boolean(
    String(approval?.by ?? "").trim()
      || String(approval?.time ?? "").trim()
      || String(approval?.comment ?? "").trim(),
  );
}

function hasInventoryItems(items) {
  return Array.isArray(items) && items.some((item) => hasText(
    item?.item,
    item?.location,
    item?.current,
    item?.safe,
    item?.unit,
    item?.note,
  ));
}

export function hasDailyRecordPayload(record) {
  if (!record) return false;
  return hasText(
    record.checkIn,
    record.checkOut,
    record.attendanceNote,
    record.notes,
    record.sales,
    record.cost,
    record.lossAmount,
    record.lossDesc,
    record.inventoryDesc,
    record.receiptDesc,
    ...Object.values(record.managerNotes || {}),
  )
    || [
      record.leaveImgs,
      record.grooming,
      record.openingPublic,
      record.openingBar,
      record.closingPublic,
      record.closingBar,
      record.lossImgs,
      record.inventoryImgs,
      record.receiptImgs,
    ].some(hasImages)
    || hasInventoryItems(record.inventoryItems)
    || Object.values(record.approvals || {}).some(hasApprovalStamp)
    || Object.values(record.studentConfirmations || {}).some(hasApprovalStamp);
}

export function pickDailyDate(week, preferredDay = "", fallbackDay = todayISO()) {
  const dates = getWeekDates(week.startDate);
  if (dates.includes(preferredDay)) {
    return preferredDay;
  }
  if (dates.includes(fallbackDay) && hasDailyRecordPayload(week.daily?.[fallbackDay])) {
    return fallbackDay;
  }
  const latestWithPayload = dates
    .slice()
    .reverse()
    .find((day) => hasDailyRecordPayload(week.daily?.[day]));
  if (latestWithPayload) return latestWithPayload;
  return dates.includes(fallbackDay) ? fallbackDay : dates[0];
}

function cloneApproval(approval = {}) {
  return {
    by: approval.by || "",
    time: approval.time || "",
    comment: approval.comment || "",
  };
}

export function cloneDailyRecord(record) {
  const tempWeek = { daily: {} };
  if (record) tempWeek.daily.__draft = record;
  const normalized = ensureDayOnWeek(tempWeek, "__draft");
  return {
    ...normalized,
    leaveImgs: [...normalized.leaveImgs],
    grooming: [...normalized.grooming],
    openingPublic: [...normalized.openingPublic],
    openingBar: [...normalized.openingBar],
    closingPublic: [...normalized.closingPublic],
    closingBar: [...normalized.closingBar],
    lossImgs: [...normalized.lossImgs],
    inventoryImgs: [...normalized.inventoryImgs],
    inventoryItems: Array.isArray(normalized.inventoryItems)
      ? normalized.inventoryItems.map((item) => ({ ...item }))
      : [],
    receiptImgs: [...normalized.receiptImgs],
    managerNotes: { ...normalized.managerNotes },
    approvals: Object.fromEntries(
      Object.entries(normalized.approvals).map(([key, approval]) => [key, cloneApproval(approval)]),
    ),
    studentConfirmations: Object.fromEntries(
      Object.entries(normalized.studentConfirmations).map(([key, approval]) => [key, cloneApproval(approval)]),
    ),
  };
}

export function updateWeekDailyRecord(week, day, mutator) {
  const nextWeek = {
    ...week,
    daily: {
      ...(week.daily || {}),
    },
  };
  nextWeek.daily[day] = cloneDailyRecord(nextWeek.daily[day]);
  mutator(nextWeek.daily[day], nextWeek);
  return nextWeek;
}
