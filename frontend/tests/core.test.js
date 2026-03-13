import test from "node:test";
import assert from "node:assert/strict";

import { createEmptyWeek, ensureDayOnWeek } from "../src/lib/core.js";

test("createEmptyWeek includes structured preparation and process modules", () => {
  const week = createEmptyWeek("2026-03-11");
  const day = ensureDayOnWeek(week, "2026-03-11");

  assert.equal(week.creative.drinks.length, 2);
  assert.deepEqual(Object.keys(week.creative.survey), [
    "questions",
    "sampleSize",
    "resultSummary",
    "resultImages",
    "analysis",
  ]);
  assert.deepEqual(Object.keys(day.processes), ["13", "14", "15", "16", "17", "18", "19", "20", "21", "22"]);
  assert.deepEqual(Object.keys(day.dailyReport), ["summary", "highlights", "issues", "followUp"]);
});

test("ensureDayOnWeek migrates legacy daily fields into structured process items", () => {
  const week = createEmptyWeek("2026-03-11");
  week.daily["2026-03-11"] = {
    checkIn: "08:30",
    checkOut: "17:30",
    attendanceNote: "迟到 5 分钟",
    notes: "今日客流平稳",
    openingPublic: ["open-a"],
    openingBar: ["open-b"],
    closingPublic: ["close-a"],
    closingBar: ["close-b"],
    inventoryDesc: "牛奶余量 2 盒",
    inventoryImgs: ["inv-a"],
    sales: "300",
    cost: "120",
    lossAmount: "10",
    lossDesc: "打翻一杯",
    approvals: {},
  };

  const day = ensureDayOnWeek(week, "2026-03-11");

  assert.equal(day.processes["19"].execution, "牛奶余量 2 盒");
  assert.deepEqual(day.processes["13"].images, ["open-a", "open-b"]);
  assert.deepEqual(day.processes["18"].images, ["close-a", "close-b"]);
  assert.match(day.processes["20"].execution, /营业额 300/);
  assert.match(day.processes["21"].execution, /打翻一杯/);
  assert.equal(day.dailyReport.issues, "今日客流平稳");
});
