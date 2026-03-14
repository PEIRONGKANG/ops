function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueTextList(values) {
  return normalizeArray(values)
    .map((value) => String(value || "").trim())
    .filter((value, index, list) => value && list.indexOf(value) === index);
}

function roundOne(value) {
  return Math.round(Number(value) * 10) / 10;
}

function compareScoreDesc(left, right) {
  return Number(right || 0) - Number(left || 0);
}

function compareUpdatedDesc(left, right) {
  return String(right?.updatedAt || "").localeCompare(String(left?.updatedAt || ""));
}

export function buildSessionSnapshot({
  token = "",
  actor = null,
  sessionUsers = [],
  selectedWeekStart = "",
  activeScopeUser = "",
}) {
  const currentSessionUsers = uniqueTextList(sessionUsers);
  const currentUser = actor
    ? {
      username: actor.username || "",
      role: actor.role || "",
      level: actor.level || "",
      displayName: actor.displayName || "",
    }
    : null;

  return {
    token: String(token || "").trim(),
    currentUser,
    currentSessionUsers,
    activeScopeUser: String(activeScopeUser || "").trim() || currentUser?.username || currentSessionUsers[0] || "",
    selectedWeekStart: String(selectedWeekStart || "").trim(),
  };
}

export function normalizeWeekWorkflow(workflow = {}) {
  return {
    status: workflow.status || "draft",
    submittedAt: workflow.submittedAt || "",
    submittedBy: workflow.submittedBy || "",
    reviewedAt: workflow.reviewedAt || "",
    reviewedBy: workflow.reviewedBy || "",
    reviewComment: workflow.reviewComment || "",
  };
}

export function getWeekWorkflowActions({ workflow, level = "", canEdit = false }) {
  const normalized = normalizeWeekWorkflow(workflow);
  if (canEdit && level === "P3" && ["draft", "rejected"].includes(normalized.status)) {
    return ["submit"];
  }
  if (["P1", "P2"].includes(level) && normalized.status === "submitted") {
    return ["approve", "reject"];
  }
  if (level === "P1" && normalized.status === "approved") {
    return ["archive"];
  }
  return [];
}

export function resolveScopeFoundationContext({ foundation, users = [], scopeUser = "", weekStartDate = "" }) {
  const payload = foundation || {};
  const memberships = normalizeArray(payload.groupMembers).filter((item) => item.studentUsername === scopeUser);
  const groupIds = memberships.map((item) => item.groupId);

  let assignment = null;
  if (weekStartDate) {
    assignment = normalizeArray(payload.scheduleAssignments)
      .filter((item) => item.weekStartDate === weekStartDate && (groupIds.includes(item.primaryGroupId) || groupIds.includes(item.secondaryGroupId)))
      .sort(compareUpdatedDesc)[0] || null;
  }
  if (!assignment) {
    assignment = normalizeArray(payload.scheduleAssignments)
      .filter((item) => groupIds.includes(item.primaryGroupId) || groupIds.includes(item.secondaryGroupId))
      .sort(compareUpdatedDesc)[0] || null;
  }

  const resolvedGroupId = assignment
    ? (groupIds.includes(assignment.primaryGroupId) ? assignment.primaryGroupId : assignment.secondaryGroupId)
    : groupIds[0];
  const group = normalizeArray(payload.groups).find((item) => item.id === resolvedGroupId) || null;
  const batchId = assignment?.batchId || group?.batchId || null;
  const batch = normalizeArray(payload.courseBatches).find((item) => item.id === batchId) || null;
  const membership = memberships.find((item) => item.groupId === resolvedGroupId) || memberships[0] || null;
  const user = normalizeArray(users).find((item) => item.username === scopeUser) || null;

  return {
    studentUsername: scopeUser,
    studentName: user?.displayName || membership?.studentName || "",
    groupId: resolvedGroupId || null,
    groupName: assignment?.primaryGroupId === resolvedGroupId
      ? (assignment?.primaryGroupName || group?.name || "")
      : (assignment?.secondaryGroupName || group?.name || ""),
    batchId,
    batchName: batch?.name || "",
    className: normalizeArray(batch?.classNames).join("、"),
    classNames: normalizeArray(batch?.classNames),
    courseName: batch?.courseName || "",
    teachingWeek: assignment?.teachingWeek || "",
    weekStartDate: assignment?.weekStartDate || weekStartDate || "",
  };
}

export function buildScoreSummary({ foundation, scopeUser = "", batchId = null }) {
  const payload = foundation || {};
  const certifications = normalizeArray(payload.certifications)
    .filter((item) => item.studentUsername === scopeUser && (!batchId || item.batchId === batchId))
    .sort(compareUpdatedDesc);
  const courseScore = normalizeArray(payload.courseScores)
    .filter((item) => item.studentUsername === scopeUser && (!batchId || item.batchId === batchId))
    .sort(compareUpdatedDesc)[0] || null;
  const showcaseEntries = normalizeArray(payload.showcaseScores)
    .filter((item) => item.studentUsername === scopeUser && (!batchId || item.batchId === batchId))
    .sort(compareUpdatedDesc);
  const showcaseAverageScore = showcaseEntries.length
    ? roundOne(showcaseEntries.reduce((sum, item) => sum + Number(item.score || 0), 0) / showcaseEntries.length)
    : null;

  return {
    courseScore,
    courseFinalScore: courseScore?.finalScore ?? null,
    showcaseAverageScore,
    showcaseEntries,
    certifications,
  };
}

export function buildRankings({ foundation, batchId = null }) {
  const payload = foundation || {};

  const courseRanking = normalizeArray(payload.courseScores)
    .filter((item) => !batchId || item.batchId === batchId)
    .slice()
    .sort((left, right) => {
      const scoreDelta = compareScoreDesc(left.finalScore, right.finalScore);
      return scoreDelta || compareUpdatedDesc(left, right);
    })
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

  const showcaseRankingMap = new Map();
  normalizeArray(payload.showcaseScores)
    .filter((item) => !batchId || item.batchId === batchId)
    .forEach((item) => {
      const key = `${item.batchId}-${item.studentUsername}`;
      const current = showcaseRankingMap.get(key) || {
        batchId: item.batchId,
        studentUsername: item.studentUsername,
        studentName: item.studentName,
        groupName: item.groupName,
        totalScore: 0,
        scoreCount: 0,
        latestUpdatedAt: item.updatedAt || "",
      };
      current.totalScore += Number(item.score || 0);
      current.scoreCount += 1;
      if (String(item.updatedAt || "") > String(current.latestUpdatedAt || "")) {
        current.latestUpdatedAt = item.updatedAt || "";
      }
      showcaseRankingMap.set(key, current);
    });

  const showcaseRanking = Array.from(showcaseRankingMap.values())
    .map((item) => ({
      ...item,
      averageScore: item.scoreCount ? roundOne(item.totalScore / item.scoreCount) : 0,
    }))
    .sort((left, right) => {
      const scoreDelta = compareScoreDesc(left.averageScore, right.averageScore);
      return scoreDelta || String(right.latestUpdatedAt || "").localeCompare(String(left.latestUpdatedAt || ""));
    })
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

  return {
    courseRanking,
    showcaseRanking,
  };
}
