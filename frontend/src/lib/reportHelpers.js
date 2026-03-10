import { ensureDayOnWeek, getWeekDates, renderApprovalText, trim } from "./core";


export { ensureDayOnWeek, getWeekDates, renderApprovalText, trim };


export function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}
