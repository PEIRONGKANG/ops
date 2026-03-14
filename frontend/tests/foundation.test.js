import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSessionSnapshot,
  buildRankings,
  buildScoreSummary,
  getWeekWorkflowActions,
  normalizeWeekWorkflow,
  resolveScopeFoundationContext,
} from "../src/lib/foundation.js";

test("resolveScopeFoundationContext and score helpers derive export and ranking data", () => {
  const foundation = {
    courseBatches: [
      {
        id: 11,
        name: "2026 春第一批",
        courseName: "门店创意饮品策划与运营实践",
        classNames: ["24 饮品 1 班"],
      },
    ],
    groups: [
      { id: 21, batchId: 11, name: "A 组" },
      { id: 22, batchId: 11, name: "B 组" },
    ],
    groupMembers: [
      { groupId: 21, studentUsername: "2401270101", studentName: "周露" },
      { groupId: 22, studentUsername: "2401270102", studentName: "刘静" },
    ],
    scheduleAssignments: [
      { batchId: 11, weekStartDate: "2026-03-11", primaryGroupId: 21, primaryGroupName: "A 组" },
    ],
    certifications: [
      { batchId: 11, studentUsername: "2401270101", roleName: "冰吧岗位", result: "PASS" },
    ],
    courseScores: [
      { batchId: 11, studentUsername: "2401270101", studentName: "周露", groupName: "A 组", finalScore: 90.8, managerScore: 88, teacherScore: 92 },
      { batchId: 11, studentUsername: "2401270102", studentName: "刘静", groupName: "B 组", finalScore: 85.5, managerScore: 84, teacherScore: 86 },
    ],
    showcaseScores: [
      { batchId: 11, studentUsername: "2401270101", studentName: "周露", groupName: "A 组", judgeName: "评委A", score: 94 },
      { batchId: 11, studentUsername: "2401270101", studentName: "周露", groupName: "A 组", judgeName: "评委B", score: 96 },
      { batchId: 11, studentUsername: "2401270102", studentName: "刘静", groupName: "B 组", judgeName: "评委A", score: 91 },
    ],
  };
  const users = [
    { username: "2401270101", displayName: "周露" },
    { username: "2401270102", displayName: "刘静" },
  ];

  const context = resolveScopeFoundationContext({
    foundation,
    users,
    scopeUser: "2401270101",
    weekStartDate: "2026-03-11",
  });
  const summary = buildScoreSummary({
    foundation,
    scopeUser: "2401270101",
    batchId: 11,
  });
  const rankings = buildRankings({
    foundation,
    batchId: 11,
  });

  assert.equal(context.batchName, "2026 春第一批");
  assert.equal(context.className, "24 饮品 1 班");
  assert.equal(context.groupName, "A 组");
  assert.equal(summary.courseFinalScore, 90.8);
  assert.equal(summary.showcaseAverageScore, 95);
  assert.equal(summary.certifications[0].roleName, "冰吧岗位");
  assert.equal(rankings.courseRanking[0].studentUsername, "2401270101");
  assert.equal(rankings.showcaseRanking[0].averageScore, 95);
});

test("session snapshot and workflow actions follow server session and role rules", () => {
  const snapshot = buildSessionSnapshot({
    token: "token-123",
    actor: {
      username: "2401270101",
      level: "P3",
      displayName: "周露",
    },
    sessionUsers: ["2401270101", "2401270102"],
    selectedWeekStart: "2026-03-11",
  });

  const draftWorkflow = normalizeWeekWorkflow();
  const submittedWorkflow = normalizeWeekWorkflow({ status: "submitted" });
  const approvedWorkflow = normalizeWeekWorkflow({ status: "approved" });

  assert.equal(snapshot.token, "token-123");
  assert.equal(snapshot.currentUser.username, "2401270101");
  assert.deepEqual(snapshot.currentSessionUsers, ["2401270101", "2401270102"]);
  assert.equal(snapshot.activeScopeUser, "2401270101");
  assert.deepEqual(
    getWeekWorkflowActions({ workflow: draftWorkflow, level: "P3", canEdit: true }),
    ["submit"],
  );
  assert.deepEqual(
    getWeekWorkflowActions({ workflow: submittedWorkflow, level: "P2", canEdit: false }),
    ["approve", "reject"],
  );
  assert.deepEqual(
    getWeekWorkflowActions({ workflow: approvedWorkflow, level: "P1", canEdit: false }),
    ["archive"],
  );
});
