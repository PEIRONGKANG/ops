import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyWeek } from "./core.js";
import { pickDailyDate, updateWeekDailyRecord } from "./dailyState.js";

test("pickDailyDate keeps the explicitly selected day when another day has payload", () => {
  const week = createEmptyWeek("2026-04-15");
  week.daily["2026-04-18"] = { notes: "filled by student" };

  assert.equal(
    pickDailyDate(week, "2026-04-17", "2026-04-18"),
    "2026-04-17",
  );
});

test("pickDailyDate falls back to today when there is no explicit selection", () => {
  const week = createEmptyWeek("2026-04-15");
  week.daily["2026-04-18"] = { notes: "filled by student" };

  assert.equal(
    pickDailyDate(week, "", "2026-04-18"),
    "2026-04-18",
  );
});

test("updateWeekDailyRecord only clones the touched day branch", () => {
  let week = updateWeekDailyRecord(createEmptyWeek("2026-04-15"), "2026-04-15", (record) => {
    record.notes = "day one";
  });
  week = updateWeekDailyRecord(week, "2026-04-16", (record) => {
    record.notes = "day two";
  });

  const untouchedDay = week.daily["2026-04-16"];
  const nextWeek = updateWeekDailyRecord(week, "2026-04-15", (record) => {
    record.notes = "updated";
  });

  assert.notEqual(nextWeek, week);
  assert.notEqual(nextWeek.daily, week.daily);
  assert.notEqual(nextWeek.daily["2026-04-15"], week.daily["2026-04-15"]);
  assert.equal(nextWeek.daily["2026-04-16"], untouchedDay);
  assert.equal(nextWeek.creative, week.creative);
});
