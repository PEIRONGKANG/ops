import test from "node:test";
import assert from "node:assert/strict";

import { createEmptyWeek } from "../src/lib/core.js";
import { buildReportHtml } from "../src/lib/report.js";

test("buildReportHtml includes personal profile and score summary on cover", () => {
  const week = createEmptyWeek("2026-03-11");
  week.members.a = "周露";
  week.creative.drinks[0].name = "青柠冷萃";

  const html = buildReportHtml({
    week,
    group: { teachingWeek: "第15周" },
    scopeUser: "2401270101",
    exportProfile: {
      studentName: "周露",
      studentUsername: "2401270101",
      className: "24 饮品 1 班",
      batchName: "2026 春第一批",
      courseName: "门店创意饮品策划与运营实践",
    },
    scoreSummary: {
      courseFinalScore: 90.8,
      showcaseAverageScore: 94,
      certifications: [
        { roleName: "冰吧岗位", result: "PASS" },
      ],
    },
  });

  assert.match(html, /周露/);
  assert.match(html, /2401270101/);
  assert.match(html, /24 饮品 1 班/);
  assert.match(html, /2026 春第一批/);
  assert.match(html, /90\.8/);
  assert.match(html, /冰吧岗位/);
});
