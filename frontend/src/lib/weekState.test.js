import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyWeek } from "./core.js";
import { updateWeekCreative, updateWeekHandover, updateWeekReflection } from "./weekState.js";

test("updateWeekCreative only clones the creative branch", () => {
  const week = createEmptyWeek("2026-04-15");
  week.daily["2026-04-16"] = { notes: "existing", receiptImgs: ["data:image/png;base64,foo"] };

  const nextWeek = updateWeekCreative(week, (creative) => {
    creative.marketing = "new plan";
    creative.posters.push("poster-a");
  });

  assert.notEqual(nextWeek, week);
  assert.notEqual(nextWeek.creative, week.creative);
  assert.equal(nextWeek.daily, week.daily);
  assert.equal(nextWeek.handover, week.handover);
  assert.equal(week.creative.marketing, "");
  assert.equal(week.creative.posters.length, 0);
});

test("updateWeekHandover only clones the handover branch", () => {
  const week = createEmptyWeek("2026-04-15");
  week.daily["2026-04-16"] = { notes: "existing", receiptImgs: ["data:image/png;base64,foo"] };

  const nextWeek = updateWeekHandover(week, (handover) => {
    handover.summary = "handover update";
    handover.photos.push("photo-a");
  });

  assert.notEqual(nextWeek, week);
  assert.notEqual(nextWeek.handover, week.handover);
  assert.equal(nextWeek.daily, week.daily);
  assert.equal(nextWeek.creative, week.creative);
  assert.equal(week.handover.summary, "");
  assert.equal(week.handover.photos.length, 0);
});

test("updateWeekReflection only clones the reflection branch", () => {
  const week = createEmptyWeek("2026-04-15");
  week.daily["2026-04-16"] = { notes: "existing", receiptImgs: ["data:image/png;base64,foo"] };

  const nextWeek = updateWeekReflection(week, (reflection) => {
    reflection.optPlan = "reflection update";
  });

  assert.notEqual(nextWeek, week);
  assert.notEqual(nextWeek.reflection, week.reflection);
  assert.equal(nextWeek.daily, week.daily);
  assert.equal(nextWeek.creative, week.creative);
  assert.equal(week.reflection.optPlan, "");
});
