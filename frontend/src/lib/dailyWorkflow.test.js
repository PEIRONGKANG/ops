import assert from "node:assert/strict";
import test from "node:test";

import { ensureDayOnWeek } from "./core.js";
import {
  createEmptyManagerReview,
  ensureManagerReview,
  getDailyRoleCapabilities,
  canEditDailyField,
  canUploadDailyImages,
  canSubmitManagerReview,
  submitManagerReview,
  renderManagerReviewText,
} from "./dailyWorkflow.js";

function buildCompleteDay() {
  return {
    checkIn: "08:30",
    checkOut: "17:30",
    attendanceNote: "无异常",
    notes: "当日运营正常",
    grooming: ["groom.jpg"],
    openingPublic: ["opening-public.jpg"],
    openingBar: ["opening-bar.jpg"],
    closingPublic: ["closing-public.jpg"],
    closingBar: ["closing-bar.jpg"],
    sales: "128.50",
    cost: "52.30",
    lossAmount: "3.00",
    lossDesc: "杯盖损耗",
    lossImgs: ["loss.jpg"],
    inventoryDesc: "珍珠余量充足",
    inventoryImgs: ["inventory.jpg"],
    receiptDesc: "已签收吸管两箱",
    receiptImgs: ["receipt.jpg"],
    approvals: {},
    managerReview: {
      attendance: "签到签退与出勤说明已核实。",
      opening: "开档卫生和吧台整理符合要求。",
      closing: "收档卫生完成。",
      finance: "财务与库存已复核。",
      receipt: "签收记录与照片一致。",
      notes: "无额外异常。",
      submittedBy: "",
      submittedAt: "",
    },
  };
}

test("createEmptyManagerReview returns the expected blank shape", () => {
  assert.deepEqual(createEmptyManagerReview(), {
    attendance: "",
    opening: "",
    closing: "",
    finance: "",
    receipt: "",
    notes: "",
    submittedBy: "",
    submittedAt: "",
  });
});

test("ensureManagerReview backfills missing fields but preserves saved content", () => {
  const review = ensureManagerReview({
    finance: "已复核",
    submittedBy: "史燕香",
  });

  assert.equal(review.finance, "已复核");
  assert.equal(review.submittedBy, "史燕香");
  assert.equal(review.attendance, "");
  assert.equal(review.notes, "");
});

test("ensureDayOnWeek normalizes managerReview for legacy daily records", () => {
  const week = { daily: { "2026-03-14": { checkIn: "08:30", approvals: {} } } };

  const day = ensureDayOnWeek(week, "2026-03-14");

  assert.deepEqual(day.managerReview, createEmptyManagerReview());
});

test("daily role capabilities allow p3 entry and p2 final review", () => {
  assert.deepEqual(getDailyRoleCapabilities("P3"), {
    canEditRawFields: true,
    canUploadImages: true,
    canEditManagerReview: false,
    canSubmitManagerReview: false,
  });
  assert.deepEqual(getDailyRoleCapabilities("P2"), {
    canEditRawFields: true,
    canUploadImages: false,
    canEditManagerReview: true,
    canSubmitManagerReview: true,
  });
});

test("canEditDailyField blocks image arrays for p2 but keeps text and time editable", () => {
  assert.equal(canEditDailyField("P2", "checkIn"), true);
  assert.equal(canEditDailyField("P2", "inventoryDesc"), true);
  assert.equal(canEditDailyField("P2", "openingPublic"), false);
  assert.equal(canUploadDailyImages("P2"), false);
  assert.equal(canUploadDailyImages("P3"), true);
});

test("canSubmitManagerReview requires a manager role and complete manager notes", () => {
  const day = buildCompleteDay();

  assert.equal(canSubmitManagerReview("P3", day), false);
  assert.equal(canSubmitManagerReview("P2", day), true);

  day.managerReview.finance = "";
  assert.equal(canSubmitManagerReview("P2", day), false);
});

test("submitManagerReview stamps reviewer metadata and legacy approval markers", () => {
  const day = buildCompleteDay();

  submitManagerReview(day, { username: "2301180107", displayName: "史燕香" }, "2026-03-14 09:00");

  assert.equal(day.managerReview.submittedBy, "史燕香");
  assert.equal(day.managerReview.submittedAt, "2026-03-14 09:00");
  assert.equal(day.approvals.checkIn.by, "史燕香");
  assert.equal(day.approvals.receipt.time, "2026-03-14 09:00");
});

test("renderManagerReviewText reflects pending and submitted states", () => {
  assert.equal(renderManagerReviewText(createEmptyManagerReview()), "待 P2 确认");

  assert.equal(
    renderManagerReviewText({ ...createEmptyManagerReview(), submittedBy: "史燕香", submittedAt: "2026-03-14 09:00" }),
    "已由 P2 确认：史燕香（2026-03-14 09:00）",
  );
});
