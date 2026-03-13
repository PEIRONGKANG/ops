import { ensureDayOnWeek, ensureWeekStructure, getWeekDates, PROCESS_ITEM_DEFINITIONS, renderApprovalText, trim } from "./core.js";


export { ensureDayOnWeek, ensureWeekStructure, getWeekDates, PROCESS_ITEM_DEFINITIONS, renderApprovalText, trim };


export function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}
