import { useEffect, useRef, useState } from "react";

import { AccountsTab } from "./components/AccountsTab";
import { CreativeTab } from "./components/CreativeTab";
import { DashboardShell } from "./components/DashboardShell";
import { DailyTab } from "./components/DailyTab";
import { HandoverTab } from "./components/HandoverTab";
import { LoginPanel } from "./components/LoginPanel";
import { ReflectionTab } from "./components/ReflectionTab";
import { Sidebar } from "./components/Sidebar";
import { TabNav } from "./components/TabNav";
import { TAB_ITEMS } from "./lib/constants";
import {
  adjustToWednesday,
  applyTeachingWeekPreset,
  buildTeachingWeekOptions,
  createEmptyWeek,
  createEmptyWeekGroup,
  emptyApproval,
  ensureDayOnWeek,
  filesToDataUrls,
  findStudentByToken,
  getStudentUsers,
  getTeachingWeekPreset,
  getWeekDates,
  levelLabel,
  makeWeekKey,
  normalizeTeacherNotice,
  normalizeUser,
  renderApprovalText,
  roleFromLevel,
  describeTeachingWeek,
  syncWeekGroupForWeek,
  todayISO,
  trim,
} from "./lib/core";
import { buildReportHtml, exportReportWord, openReportPreview } from "./lib/report";
import { api } from "./services/api";


const SESSION_KEY = "ops_training_ops_react_session_v1";
const DAY_LABELS = ["周三", "周四", "周五", "周六", "周日", "周一", "周二", "次周三（交接）"];

const initialState = {
  users: [],
  currentUser: null,
  currentSessionUsers: [],
  weeks: {},
  weekGroups: {},
  currentWeekKey: "",
  currentDay: "",
  selectedWeekStart: adjustToWednesday(todayISO()),
  activeScopeUser: "",
  scopeUserPinned: false,
  activeTab: "creative",
  loginForm: {
    username: "",
    password: "",
    secondUsername: "",
    secondPassword: "",
  },
  loginMessage: "",
  statusMessage: "准备就绪。",
  statusError: false,
  loading: false,
  weekLoading: false,
  booting: true,
  passwordForm: { newPassword: "" },
  newUserForm: {
    username: "",
    displayName: "",
    password: "123456",
    level: "P3",
  },
  editUserId: "",
  editForm: {
    displayName: "",
    password: "",
  },
  teacherNotices: [],
  teacherNoticeForm: {
    title: "",
    message: "",
    images: [],
  },
  teacherNoticeSaving: false,
  teacherNoticeBusyId: "",
};

function cloneValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function loadStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function hasText(...values) {
  return values.some((value) => trim(value));
}

function hasImages(images) {
  return Array.isArray(images) && images.length > 0;
}

function hasApprovalStamp(approval) {
  return Boolean(trim(approval?.by) || trim(approval?.time) || trim(approval?.comment));
}

function hasDailyRecordPayload(record) {
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
    || Object.values(record.approvals || {}).some(hasApprovalStamp)
    || Object.values(record.studentConfirmations || {}).some(hasApprovalStamp);
}

function hasWeekPayload(week) {
  if (!week) return false;
  return hasText(
    week.creative?.marketing,
    week.creative?.recipe,
    week.creative?.procurement,
    week.handover?.summary,
    week.handover?.nextGroup,
    week.reflection?.a,
    week.reflection?.b,
    week.reflection?.optPlan,
    week.reflection?.managerComment,
  )
    || hasImages(week.creative?.posters)
    || hasImages(week.handover?.photos)
    || hasApprovalStamp(week.creative?.approval)
    || hasApprovalStamp(week.handover?.approval)
    || hasApprovalStamp(week.reflection?.approval)
    || Object.values(week.daily || {}).some(hasDailyRecordPayload);
}

function pickPreferredDailyDate(week, preferredDay = "") {
  const dates = getWeekDates(week.startDate);
  if (dates.includes(preferredDay) && hasDailyRecordPayload(week.daily?.[preferredDay])) {
    return preferredDay;
  }
  const latestWithPayload = dates
    .slice()
    .reverse()
    .find((day) => hasDailyRecordPayload(week.daily?.[day]));
  if (latestWithPayload) return latestWithPayload;
  return dates.includes(preferredDay) ? preferredDay : dates[0];
}

function getDailyApprovalDefaults() {
  return {
    checkIn: true,
    checkOut: true,
    grooming: true,
    opening: true,
    closing: true,
    finance: true,
    receipt: true,
    notes: true,
  };
}

const DAILY_FIELD_RESET_MAP = {
  checkIn: ["checkIn"],
  checkOut: ["checkOut"],
  attendanceNote: ["checkIn", "checkOut"],
  sales: ["finance"],
  cost: ["finance"],
  lossAmount: ["finance"],
  lossDesc: ["finance"],
  inventoryDesc: ["finance"],
  receiptDesc: ["receipt"],
  notes: ["notes"],
};

const DAILY_IMAGE_CONFIG = {
  groom: { key: "grooming", reviewKinds: ["grooming"] },
  openingPublic: { key: "openingPublic", reviewKinds: ["opening"] },
  openingBar: { key: "openingBar", reviewKinds: ["opening"] },
  closingPublic: { key: "closingPublic", reviewKinds: ["closing"] },
  closingBar: { key: "closingBar", reviewKinds: ["closing"] },
  loss: { key: "lossImgs", reviewKinds: ["finance"] },
  inventory: { key: "inventoryImgs", reviewKinds: ["finance"] },
  receipt: { key: "receiptImgs", reviewKinds: ["receipt"] },
  leave: { key: "leaveImgs", reviewKinds: ["checkIn", "checkOut"] },
};

function resetStampedApproval(target) {
  if (!target) return;
  target.by = "";
  target.time = "";
  target.comment = "";
}

function App() {
  const [app, setApp] = useState(initialState);
  const stateRef = useRef(initialState);

  useEffect(() => {
    stateRef.current = app;
  }, [app]);

  const replaceState = (next) => {
    stateRef.current = next;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        currentUser: next.currentUser,
        currentSessionUsers: next.currentSessionUsers,
        activeScopeUser: next.activeScopeUser,
        scopeUserPinned: next.scopeUserPinned,
        selectedWeekStart: next.selectedWeekStart,
      }),
    );
    setApp(next);
    return next;
  };

  const applyState = (mutator) => {
    const next = cloneValue(stateRef.current);
    mutator(next);
    return replaceState(next);
  };

  const setStatus = (message, isError = false) => {
    applyState((draft) => {
      draft.statusMessage = message;
      draft.statusError = isError;
    });
  };

  const runAction = async (action, fallbackMessage = "操作失败，请稍后重试。") => {
    try {
      return await action();
    } catch (error) {
      setStatus(error.message || fallbackMessage, true);
      return null;
    }
  };

  const getCurrentUserRecord = (source = stateRef.current) => {
    const current = source.currentUser;
    if (!current) return null;
    return source.users.find((user) => user.username === current.username) || null;
  };

  const getCurrentSessionUsers = (source = stateRef.current) => {
    if (!Array.isArray(source.currentSessionUsers)) source.currentSessionUsers = [];
    const valid = source.currentSessionUsers
      .map(trim)
      .filter((username, index, list) => username && list.indexOf(username) === index)
      .filter((username) => source.users.some((user) => user.username === username && user.level === "P3"));
    source.currentSessionUsers = valid;
    return valid;
  };

  const canApprove = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    return !!user && (user.level === "P1" || user.level === "P2");
  };

  const canManageAccounts = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    return !!user && user.level === "P1";
  };

  const canEditCurrentScopeData = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    return !!user && (user.level === "P1" || user.level === "P3");
  };

  const canEditDailyContent = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    return !!user && (user.level === "P1" || user.level === "P3");
  };

  const canReviewDaily = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    return !!user && (user.level === "P1" || user.level === "P2");
  };

  const canStudentConfirmDaily = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    return !!user && (user.level === "P1" || user.level === "P3");
  };

  const shouldResetDailyReviewState = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    return !!user && user.level === "P3";
  };

  const resetDailyReviewState = (record, reviewKinds = []) => {
    reviewKinds.forEach((kind) => {
      if (!kind) return;
      record.managerNotes[kind] = "";
      resetStampedApproval(record.approvals[kind]);
      resetStampedApproval(record.studentConfirmations[kind]);
    });
  };

  const canViewAllScopes = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    return !!user && (user.level === "P1" || user.level === "P2");
  };

  const getGroupedScopeUsers = (source, startDate) => {
    if (!trim(startDate)) return [];
    return [getWeekGroupRecord(source, startDate).a, getWeekGroupRecord(source, startDate).b]
      .map((item) => findStudentByToken(source.users, item))
      .filter(Boolean)
      .map((item) => item.username);
  };

  const resolveScopeUser = (source = stateRef.current, preferredStartDate = source.selectedWeekStart) => {
    const user = getCurrentUserRecord(source);
    if (!user) return "";
    if (!canViewAllScopes(source)) return user.username;
    const groupedUsers = getGroupedScopeUsers(source, preferredStartDate);
    const hasValidScopeUser = source.activeScopeUser
      && source.users.some((item) => item.username === source.activeScopeUser && item.level === "P3");
    if (hasValidScopeUser && (source.scopeUserPinned || !groupedUsers.length || groupedUsers.includes(source.activeScopeUser))) {
      return source.activeScopeUser;
    }
    if (groupedUsers.length) {
      source.activeScopeUser = groupedUsers[0];
      source.scopeUserPinned = false;
      return source.activeScopeUser;
    }
    const firstStudent = getStudentUsers(source.users)[0];
    source.activeScopeUser = firstStudent ? firstStudent.username : user.username;
    source.scopeUserPinned = false;
    return source.activeScopeUser;
  };

  const getWeekGroupRecord = (source, startDate) => {
    if (!source.weekGroups[startDate]) {
      source.weekGroups[startDate] = createEmptyWeekGroup();
    }
    if (!source.weekGroups[startDate].teachingWeek) {
      source.weekGroups[startDate].teachingWeek = "";
    }
    return source.weekGroups[startDate];
  };

  const applyWeekGroupToLoadedWeeks = (source, startDate) => {
    const shared = getWeekGroupRecord(source, startDate);
    Object.values(source.weeks).forEach((week) => {
      if (trim(week.startDate) !== trim(startDate)) return;
      syncWeekGroupForWeek(week, shared);
    });
  };

  const seedWeekGroupFromSession = (source, startDate) => {
    const current = getCurrentUserRecord(source);
    if (!current || current.level !== "P3") return;
    const shared = getWeekGroupRecord(source, startDate);
    if (trim(shared.a) || trim(shared.b)) return;
    const sessionUsers = getCurrentSessionUsers(source);
    if (!sessionUsers.length) return;
    const names = sessionUsers.map((username) => {
      const user = source.users.find((item) => item.username === username);
      return user ? (user.displayName || user.username) : username;
    });
    shared.a = names[0] || "";
    shared.b = names[1] || "";
    applyWeekGroupToLoadedWeeks(source, startDate);
  };

  const ensureWeekInState = (source, weekKey, startDate) => {
    if (!source.weeks[weekKey]) {
      source.weeks[weekKey] = createEmptyWeek(startDate);
    }
    const week = source.weeks[weekKey];
    const shared = getWeekGroupRecord(source, week.startDate);
    seedWeekGroupFromSession(source, week.startDate);
    syncWeekGroupForWeek(week, shared);
    return week;
  };

  const getWeekScopeUsers = (source, week) => {
    const current = getCurrentUserRecord(source);
    if (!current || !week) return [];
    if (current.level === "P3") {
      const sessionUsers = getCurrentSessionUsers(source);
      return sessionUsers.length ? sessionUsers : [current.username];
    }
    const groupedUsers = [
      ...[week.members?.a, week.members?.b]
        .map((item) => findStudentByToken(source.users, item))
        .filter(Boolean)
        .map((item) => item.username),
      ...getGroupedScopeUsers(source, week.startDate),
    ]
      .filter(Boolean);
    if (groupedUsers.length) return Array.from(new Set(groupedUsers));
    const scope = resolveScopeUser(source, week.startDate);
    return scope ? [scope] : [];
  };

  const persistWeeks = async (source, startDate, usernames) => {
    const targets = Array.from(new Set(usernames.filter(Boolean)));
    await Promise.all(
      targets.map((username) => api.saveWeek(username, startDate, source.weeks[makeWeekKey(startDate, username)])),
    );
  };

  const persistGroupAndWeeks = async (source, startDate) => {
    const shared = getWeekGroupRecord(source, startDate);
    const currentWeek = source.currentWeekKey ? source.weeks[source.currentWeekKey] : null;
    const loadedUsers = Object.entries(source.weeks)
      .filter(([, week]) => trim(week.startDate) === trim(startDate))
      .map(([key]) => key.split("::")[0]);
    const targetUsers = currentWeek ? getWeekScopeUsers(source, currentWeek) : [];
    const usernames = Array.from(new Set([...loadedUsers, ...targetUsers].filter(Boolean)));
    usernames.forEach((username) => {
      const weekKey = makeWeekKey(startDate, username);
      ensureWeekInState(source, weekKey, startDate);
    });
    applyWeekGroupToLoadedWeeks(source, startDate);
    await api.saveWeekGroup(startDate, shared);
    await persistWeeks(source, startDate, usernames);
  };

  const withScopedWeeks = async (mutator) => {
    const next = cloneValue(stateRef.current);
    const baseWeek = next.weeks[next.currentWeekKey];
    if (!baseWeek) return next;
    const usernames = getWeekScopeUsers(next, baseWeek);
    const fallbackUser = trim(String(next.currentWeekKey).split("::")[0]);
    const targets = Array.from(new Set((usernames.length ? usernames : [fallbackUser]).filter(Boolean)));
    targets.forEach((username) => {
      const weekKey = makeWeekKey(baseWeek.startDate, username);
      ensureWeekInState(next, weekKey, baseWeek.startDate);
      mutator(next.weeks[weekKey], username, next);
    });
    replaceState(next);
    await persistWeeks(next, baseWeek.startDate, targets);
    return next;
  };

  const stampApproval = (source, target) => {
    if (!canApprove(source)) return false;
    const actor = getCurrentUserRecord(source);
    target.by = actor?.displayName || actor?.username || "";
    target.time = new Date().toLocaleString();
    target.comment = "";
    return true;
  };

  const stampStudentConfirmation = (source, target) => {
    if (!canStudentConfirmDaily(source)) return false;
    const actor = getCurrentUserRecord(source);
    target.by = actor?.displayName || actor?.username || "";
    target.time = new Date().toLocaleString();
    target.comment = "";
    return true;
  };

  const syncEditForms = (source) => {
    const sorted = source.users.slice().sort((a, b) => a.username.localeCompare(b.username));
    const fallbackId = sorted.some((user) => user.username === source.editUserId)
      ? source.editUserId
      : (sorted[0]?.username || "");
    source.editUserId = fallbackId;
    const target = sorted.find((user) => user.username === fallbackId);
    source.editForm.displayName = target?.displayName || "";
    source.editForm.password = target?.password || "";
  };

  const requireCurrentWeek = (message) => {
    const week = stateRef.current.currentWeekKey ? stateRef.current.weeks[stateRef.current.currentWeekKey] : null;
    if (!week) {
      setStatus(message, true);
      return null;
    }
    return week;
  };

  const getTeacherNoticeReceiptTargets = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    if (!user) return [];

    if (user.level === "P3") {
      const sessionUsers = getCurrentSessionUsers(source);
      const usernames = sessionUsers.length ? sessionUsers : [user.username];
      return usernames.map((username) => {
        const record = source.users.find((item) => item.username === username);
        return {
          username: record?.username || username,
          displayName: record?.displayName || username,
          level: record?.level || user.level,
        };
      });
    }

    return [{
      username: user.username,
      displayName: user.displayName || user.username,
      level: user.level,
    }];
  };

  const hasTeacherNoticeBeenAcknowledged = (notice, source = stateRef.current) => {
    const targets = getTeacherNoticeReceiptTargets(source).map((item) => item.username);
    if (!targets.length) return false;
    return targets.every((username) => notice.receipts?.some((receipt) => receipt.username === username));
  };

  const applyTeacherNoticeResult = (source, notice, prepend = false) => {
    const normalized = normalizeTeacherNotice(notice);
    const index = source.teacherNotices.findIndex((item) => item.id === normalized.id);
    if (index >= 0) {
      source.teacherNotices[index] = normalized;
      return;
    }
    if (prepend) {
      source.teacherNotices.unshift(normalized);
      return;
    }
    source.teacherNotices.push(normalized);
  };

  const loadWeekForCurrentScope = async (startRaw, statusMessage, options = {}) => {
    const pending = cloneValue(stateRef.current);
    const corrected = adjustToWednesday(startRaw || pending.selectedWeekStart || todayISO());
    pending.selectedWeekStart = corrected;
    pending.weekLoading = true;
    pending.currentWeekKey = "";
    pending.currentDay = "";
    pending.statusMessage = "正在加载本周数据。若本周上传了较多图片，首次打开可能需要 10 到 30 秒。";
    pending.statusError = false;
    replaceState(pending);
    try {
      const next = cloneValue(stateRef.current);
      const groupResponse = await api.fetchWeekGroup(corrected);
      next.weekGroups[corrected] = groupResponse.group || createEmptyWeekGroup();
      let scopeUser = "";
      let selectedWeek = null;

      if (options.forceGroupedScope && canViewAllScopes(next)) {
        const groupedUsers = getGroupedScopeUsers(next, corrected);
        const groupedCandidates = [];
        for (const username of groupedUsers) {
          const weekKey = makeWeekKey(corrected, username);
          const weekResponse = await api.fetchWeek(username, corrected);
          const week = weekResponse.week || createEmptyWeek(corrected);
          next.weeks[weekKey] = week;
          groupedCandidates.push({ username, week });
        }
        const preferredCandidate = groupedCandidates.find((candidate) => hasWeekPayload(candidate.week)) || groupedCandidates[0];
        if (preferredCandidate) {
          scopeUser = preferredCandidate.username;
          selectedWeek = preferredCandidate.week;
          next.activeScopeUser = scopeUser;
          next.scopeUserPinned = false;
        }
      }

      if (!scopeUser) {
        scopeUser = resolveScopeUser(next, corrected);
      }
      if (!scopeUser) {
        throw new Error("当前没有可查看的学生账号，请先确认账号数据。");
      }

      const weekKey = makeWeekKey(corrected, scopeUser);
      if (!selectedWeek) {
        const weekResponse = await api.fetchWeek(scopeUser, corrected);
        selectedWeek = weekResponse.week || createEmptyWeek(corrected);
      }
      next.weeks[weekKey] = selectedWeek;
      ensureWeekInState(next, weekKey, corrected);
      next.currentWeekKey = weekKey;
      next.currentDay = pickPreferredDailyDate(next.weeks[weekKey], next.currentDay);
      ensureDayOnWeek(next.weeks[weekKey], next.currentDay);
      next.weekLoading = false;
      next.statusMessage = statusMessage || "已加载所选周次。";
      next.statusError = false;
      replaceState(next);
    } catch (error) {
      const failed = cloneValue(stateRef.current);
      failed.weekLoading = false;
      replaceState(failed);
      throw error;
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const { users, teacherNotices = [] } = await api.bootstrap();
        const normalizedUsers = users.map(normalizeUser);
        const storedSession = loadStoredSession();
        const next = cloneValue(initialState);
        next.users = normalizedUsers;
        next.teacherNotices = teacherNotices.map(normalizeTeacherNotice);
        next.selectedWeekStart = trim(storedSession?.selectedWeekStart) || adjustToWednesday(todayISO());
        if (storedSession?.currentUser) {
          const found = normalizedUsers.find((user) => user.username === trim(storedSession.currentUser.username));
          if (found) {
            next.currentUser = {
              username: found.username,
              role: found.role,
              level: found.level,
              displayName: found.displayName,
            };
            next.currentSessionUsers = Array.isArray(storedSession.currentSessionUsers)
              ? storedSession.currentSessionUsers
              : (found.level === "P3" ? [found.username] : []);
            next.activeScopeUser = found.level === "P3" ? found.username : (storedSession.activeScopeUser || "");
            next.scopeUserPinned = found.level === "P3" ? true : Boolean(storedSession.scopeUserPinned);
          }
        }
        syncEditForms(next);
        next.booting = false;
        replaceState(next);
        if (next.currentUser) {
          await loadWeekForCurrentScope(next.selectedWeekStart, "已恢复上次会话。", { forceGroupedScope: true });
        }
      } catch (error) {
        replaceState({
          ...cloneValue(initialState),
          booting: false,
          statusMessage: error.message || "系统初始化失败。",
          statusError: true,
        });
      }
    };

    boot();
    // The session restore flow is intentionally a one-time startup effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentUser = getCurrentUserRecord();
  const currentWeek = app.currentWeekKey ? app.weeks[app.currentWeekKey] : null;
  const currentWeekGroup = currentWeek ? app.weekGroups[currentWeek.startDate] || createEmptyWeekGroup() : createEmptyWeekGroup();
  const currentDayData = currentWeek && app.currentDay ? ensureDayOnWeek(currentWeek, app.currentDay) : null;

  const sessionInfo = (() => {
    if (!currentUser) return "当前未登录。";
    if (currentUser.level !== "P3") return "当前为管理账号单独登录。";
    const sessionUsers = getCurrentSessionUsers();
    const labels = sessionUsers.map((username) => {
      const user = app.users.find((item) => item.username === username);
      return user ? `${user.displayName}（${user.username}）` : username;
    });
    if (labels.length > 1) {
      return `双人协同登录：${labels.join("、")}。本次录入会同步到这两个学生账号。`;
    }
    return `单人登录：${labels[0] || `${currentUser.displayName}（${currentUser.username}）`}。本次录入同步到当前账号。`;
  })();

  const dashboardSessionInfo = (() => {
    if (!currentUser) return "当前未登录。";
    if (currentUser.level !== "P3") return "当前为管理账号单独登录。";
    const sessionUsers = getCurrentSessionUsers();
    const labels = sessionUsers.map((username) => {
      const user = app.users.find((item) => item.username === username);
      return user ? `${user.displayName || user.username}（${user.username}）` : username;
    });
    if (labels.length > 1) {
      return `双人协同登录：${labels.join("、")}。本次录入会同步到这两个学生账号。`;
    }
    return `单人登录：${labels[0] || `${currentUser.displayName || currentUser.username}（${currentUser.username}）`}。本次录入同步到当前账号。`;
  })();

  const dailyDateOptions = currentWeek
    ? getWeekDates(currentWeek.startDate).map((value, index) => ({
      value,
      label: `${value} ${DAY_LABELS[index]}`,
    }))
    : [];

  const creativeApproveDisabled = !canApprove() || !currentWeek
    || !(hasText(currentWeek.creative.marketing, currentWeek.creative.recipe, currentWeek.creative.procurement) || hasImages(currentWeek.creative.posters));

  const dailyManagerSubmitDisabled = currentDayData
    ? {
      checkIn: !canReviewDaily() || !(
        hasText(currentDayData.checkIn, currentDayData.attendanceNote)
        || hasImages(currentDayData.leaveImgs)
      ) || !trim(currentDayData.managerNotes.checkIn),
      checkOut: !canReviewDaily() || !(
        hasText(currentDayData.checkOut, currentDayData.attendanceNote)
        || hasImages(currentDayData.leaveImgs)
      ) || !trim(currentDayData.managerNotes.checkOut),
      grooming: !canReviewDaily() || !hasImages(currentDayData.grooming) || !trim(currentDayData.managerNotes.grooming),
      opening: !canReviewDaily() || !(hasImages(currentDayData.openingPublic) || hasImages(currentDayData.openingBar)) || !trim(currentDayData.managerNotes.opening),
      closing: !canReviewDaily() || !(hasImages(currentDayData.closingPublic) || hasImages(currentDayData.closingBar)) || !trim(currentDayData.managerNotes.closing),
      finance: !canReviewDaily() || !trim(currentDayData.managerNotes.finance) || !(
        hasText(currentDayData.sales, currentDayData.cost, currentDayData.lossAmount, currentDayData.lossDesc, currentDayData.inventoryDesc)
        || hasImages(currentDayData.lossImgs)
        || hasImages(currentDayData.inventoryImgs)
      ),
      receipt: !canReviewDaily() || !trim(currentDayData.managerNotes.receipt) || !(hasText(currentDayData.receiptDesc) || hasImages(currentDayData.receiptImgs)),
      notes: !canReviewDaily() || !trim(currentDayData.managerNotes.notes),
    }
    : getDailyApprovalDefaults();

  const dailyStudentConfirmDisabled = currentDayData
    ? {
      checkIn: !canStudentConfirmDaily() || !trim(currentDayData.approvals.checkIn.by) || !!trim(currentDayData.studentConfirmations.checkIn.by),
      checkOut: !canStudentConfirmDaily() || !trim(currentDayData.approvals.checkOut.by) || !!trim(currentDayData.studentConfirmations.checkOut.by),
      grooming: !canStudentConfirmDaily() || !trim(currentDayData.approvals.grooming.by) || !!trim(currentDayData.studentConfirmations.grooming.by),
      opening: !canStudentConfirmDaily() || !trim(currentDayData.approvals.opening.by) || !!trim(currentDayData.studentConfirmations.opening.by),
      closing: !canStudentConfirmDaily() || !trim(currentDayData.approvals.closing.by) || !!trim(currentDayData.studentConfirmations.closing.by),
      finance: !canStudentConfirmDaily() || !trim(currentDayData.approvals.finance.by) || !!trim(currentDayData.studentConfirmations.finance.by),
      receipt: !canStudentConfirmDaily() || !trim(currentDayData.approvals.receipt.by) || !!trim(currentDayData.studentConfirmations.receipt.by),
      notes: !canStudentConfirmDaily() || !trim(currentDayData.approvals.notes.by) || !!trim(currentDayData.studentConfirmations.notes.by),
    }
    : getDailyApprovalDefaults();

  const handoverApproveDisabled = !canApprove() || !currentWeek
    || !(hasText(currentWeek.handover.summary, currentWeek.handover.nextGroup || currentWeek.nextGroup) || hasImages(currentWeek.handover.photos));

  const reflectionApproveDisabled = !canApprove() || !currentWeek
    || !(hasText(currentWeek.reflection.a, currentWeek.reflection.b, currentWeek.reflection.optPlan, currentWeek.reflection.managerComment));

  const reflectionSaveLabel = canApprove() && !canEditCurrentScopeData() ? "保存经理评语" : "保存总结";

  const deleteHint = (() => {
    if (!canManageAccounts()) return "仅 P1 账号可删除账号。";
    if (!app.editUserId) return "请选择需要删除的账号。";
    if (app.editUserId === currentUser?.username) return "不能删除当前登录账号，请切换到其他 P1 账号后再操作。";
    return "删除账号会同时移除该账号名下的周报数据，请谨慎操作。";
  })();

  const handleLoginFormChange = (field, value) => {
    applyState((draft) => {
      draft.loginForm[field] = value;
    });
  };

  const handleTeacherNoticeImagesAdd = async (files) => {
    const images = await filesToDataUrls(files);
    applyState((draft) => {
      draft.teacherNoticeForm.images = draft.teacherNoticeForm.images.concat(images.filter(Boolean));
    });
  };

  const handleTeacherNoticeImageRemove = (index) => {
    applyState((draft) => {
      draft.teacherNoticeForm.images = draft.teacherNoticeForm.images.filter((_, imageIndex) => imageIndex !== index);
    });
  };

  const handleTeacherNoticeCreate = async (draftOverride = {}) => runAction(async () => {
    const actor = currentUser || getCurrentUserRecord();
    if (!actor || actor.level !== "P1") {
      throw new Error("只有 P1 教师可以发布留言。");
    }

    const title = trim(draftOverride.title || app.teacherNoticeForm.title);
    const message = trim(draftOverride.message || app.teacherNoticeForm.message);
    const images = app.teacherNoticeForm.images.filter(Boolean);
    if (!title && !message && !images.length) {
      throw new Error("请至少填写标题、正文或上传一张图片。");
    }

    applyState((draft) => {
      draft.teacherNoticeSaving = true;
    });

    try {
      const { notice } = await api.createTeacherNotice({
        title,
        message,
        images,
        authorUsername: actor.username,
        authorDisplayName: actor.displayName || actor.username,
      });

      applyState((draft) => {
        applyTeacherNoticeResult(draft, notice, true);
        draft.teacherNoticeForm = { title: "", message: "", images: [] };
        draft.teacherNoticeSaving = false;
      });
      setStatus("带教留言已发布，登录前后都能查看。");
      return true;
    } catch (error) {
      applyState((draft) => {
        draft.teacherNoticeSaving = false;
      });
      throw error;
    }
  }, "发布留言失败，请稍后重试。");

  const handleTeacherNoticeDelete = async (noticeId) => runAction(async () => {
    if (!window.confirm("确认删除这条带教留言吗？删除后所有人都将不可见。")) {
      return;
    }

    applyState((draft) => {
      draft.teacherNoticeBusyId = noticeId;
    });

    try {
      await api.deleteTeacherNotice(noticeId);
      applyState((draft) => {
        draft.teacherNotices = draft.teacherNotices.filter((notice) => notice.id !== noticeId);
        draft.teacherNoticeBusyId = "";
      });
      setStatus("带教留言已删除。");
    } catch (error) {
      applyState((draft) => {
        draft.teacherNoticeBusyId = "";
      });
      throw error;
    }
  }, "删除留言失败，请稍后重试。");

  const handleTeacherNoticeAcknowledge = async (noticeId) => runAction(async () => {
    const notice = stateRef.current.teacherNotices.find((item) => item.id === noticeId);
    if (!notice) {
      throw new Error("当前留言不存在，可能已被删除。");
    }

    const targets = getTeacherNoticeReceiptTargets();
    if (!targets.length) {
      throw new Error("请先登录后再确认收到。");
    }

    const missingReceipts = targets.filter(
      (target) => !notice.receipts?.some((receipt) => receipt.username === target.username),
    );
    if (!missingReceipts.length) {
      setStatus("这条留言已经确认收到。");
      return;
    }

    applyState((draft) => {
      draft.teacherNoticeBusyId = noticeId;
    });

    try {
      const { notice: updatedNotice } = await api.acknowledgeTeacherNotice(noticeId, missingReceipts);
      applyState((draft) => {
        applyTeacherNoticeResult(draft, updatedNotice);
        draft.teacherNoticeBusyId = "";
      });
      setStatus(missingReceipts.length > 1 ? "本组已确认收到这条带教留言。" : "已确认收到这条带教留言。");
    } catch (error) {
      applyState((draft) => {
        draft.teacherNoticeBusyId = "";
      });
      throw error;
    }
  }, "确认收到失败，请稍后重试。");

  const handleLogin = async () => {
    const next = cloneValue(stateRef.current);
    next.loading = true;
    next.loginMessage = "";
    replaceState(next);

    try {
      const { username, password, secondUsername, secondPassword } = stateRef.current.loginForm;
      const first = await api.login({ username: trim(username), password: trim(password) });
      let sessionUsers = [];

      if (trim(secondUsername) || trim(secondPassword)) {
        if (!trim(secondUsername) || !trim(secondPassword)) {
          throw new Error("如需双人登录，请完整填写账号二和密码二。");
        }
        const second = await api.login({ username: trim(secondUsername), password: trim(secondPassword) });
        if (first.user.username === second.user.username) {
          throw new Error("双人登录不能重复填写同一个账号。");
        }
        if (first.user.level !== "P3" || second.user.level !== "P3") {
          throw new Error("双人登录仅支持学生账号。");
        }
        sessionUsers = [first.user.username, second.user.username];
      } else if (first.user.level === "P3") {
        sessionUsers = [first.user.username];
      }

      applyState((draft) => {
        draft.currentUser = {
          username: first.user.username,
          role: first.user.role,
          level: first.user.level,
          displayName: first.user.displayName,
        };
        draft.currentSessionUsers = sessionUsers;
        draft.activeScopeUser = first.user.level === "P3" ? first.user.username : "";
        draft.scopeUserPinned = first.user.level === "P3";
        draft.loginForm.password = "";
        draft.loginForm.secondPassword = "";
        draft.loginMessage = "";
      });

      await loadWeekForCurrentScope(
        todayISO(),
        sessionUsers.length > 1
          ? "双人登录成功。已自动加载本周轮值并同步到本组账号。"
          : "登录成功。已自动加载本周轮值。",
        { forceGroupedScope: true },
      );
      applyState((draft) => {
        draft.loading = false;
      });
    } catch (error) {
      applyState((draft) => {
        draft.loading = false;
        draft.weekLoading = false;
        if (draft.currentUser) {
          draft.statusMessage = error.message || "加载本周失败。";
          draft.statusError = true;
          draft.loginMessage = "";
          return;
        }
        draft.loginMessage = error.message || "登录失败。";
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    replaceState({
      ...cloneValue(initialState),
      users: stateRef.current.users,
      teacherNotices: stateRef.current.teacherNotices,
      booting: false,
    });
  };

  const handleWeekStartChange = (value) => {
    applyState((draft) => {
      draft.selectedWeekStart = value;
    });
  };

  const handleLoadWeek = async () => runAction(async () => {
    const raw = stateRef.current.selectedWeekStart || todayISO();
    const corrected = adjustToWednesday(raw);
    const currentLoadedStart = stateRef.current.currentWeekKey
      ? stateRef.current.weeks[stateRef.current.currentWeekKey]?.startDate || ""
      : "";
    await loadWeekForCurrentScope(
      corrected,
      raw !== corrected ? `已自动调整到最近周三：${corrected}` : "已加载所选周次。",
      { forceGroupedScope: canViewAllScopes() && trim(corrected) !== trim(currentLoadedStart) },
    );
  }, "加载周次失败，请稍后重试。");

  const handleScopeChange = async (scopeUser) => runAction(async () => {
    applyState((draft) => {
      draft.activeScopeUser = scopeUser;
      draft.scopeUserPinned = true;
    });
    await loadWeekForCurrentScope(stateRef.current.selectedWeekStart || todayISO(), `已切换查看：${scopeUser}`);
  }, "切换查看对象失败，请稍后重试。");

  const handleTabChange = (tab) => {
    applyState((draft) => {
      draft.activeTab = tab;
    });
  };

  const handleTeachingWeekChange = async (value) => runAction(async () => {
    const next = cloneValue(stateRef.current);
    const week = next.weeks[next.currentWeekKey];
    if (!week) throw new Error("请先加载本周后再设置教学周次。");
    const shared = getWeekGroupRecord(next, week.startDate);
    applyTeachingWeekPreset(shared, value);
    applyWeekGroupToLoadedWeeks(next, week.startDate);
    replaceState(next);
    await persistGroupAndWeeks(next, week.startDate);
    const preset = getTeachingWeekPreset(value);
    if (preset?.a || preset?.b) setStatus(`已套用 ${preset.label} 分组名单。`);
    else if (preset?.note) setStatus(`已记录 ${preset.label} 安排：${preset.note}。`);
    else setStatus("已切换为手动填写分组。");
  }, "教学周次保存失败，请稍后重试。");

  const handleGroupChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      const shared = getWeekGroupRecord(draft, week.startDate);
      if (field === "memberA") shared.a = value;
      if (field === "memberB") shared.b = value;
      if (field === "nextGroup") shared.nextGroup = value;
      applyWeekGroupToLoadedWeeks(draft, week.startDate);
    });
  };

  const handleSaveGroup = async () => runAction(async () => {
    const next = cloneValue(stateRef.current);
    const week = next.weeks[next.currentWeekKey];
    if (!week) throw new Error("请先加载本周后再保存分组。");
    applyWeekGroupToLoadedWeeks(next, week.startDate);
    replaceState(next);
    await persistGroupAndWeeks(next, week.startDate);
    setStatus("分组信息已按本周保存，本周无需重复填写。");
  }, "分组信息保存失败，请稍后重试。");

  const handleCreativeFieldChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.creative[field] = value;
    });
  };

  const handleDailyDateChange = (value) => {
    applyState((draft) => {
      draft.currentDay = value;
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      ensureDayOnWeek(week, value);
    });
  };

  const handleDailyFieldChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week || !draft.currentDay) return;
      const record = ensureDayOnWeek(week, draft.currentDay);
      record[field] = value;
      if (shouldResetDailyReviewState(draft)) {
        resetDailyReviewState(record, DAILY_FIELD_RESET_MAP[field] || []);
      }
    });
  };

  const handleDailyManagerNoteChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week || !draft.currentDay) return;
      ensureDayOnWeek(week, draft.currentDay).managerNotes[field] = value;
    });
  };

  const handleHandoverFieldChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.handover[field] = value;
    });
  };

  const handleReflectionFieldChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.reflection[field] = value;
    });
  };

  const saveCreative = async () => {
    const week = requireCurrentWeek("请先加载本周后再保存创意策划。");
    if (!week) return;
    const source = cloneValue(week);
    await withScopedWeeks((week) => {
      week.creative = cloneValue(source.creative);
    });
    setStatus("已保存：周三策划提交模块。");
  };

  const saveDaily = async () => {
    const sourceWeek = requireCurrentWeek("请先加载本周后再保存当日记录。");
    if (!sourceWeek || !stateRef.current.currentDay) {
      setStatus("请先选择需要保存的日期。", true);
      return;
    }
    const sourceDay = cloneValue(ensureDayOnWeek(sourceWeek, stateRef.current.currentDay));
    await withScopedWeeks((week) => {
      week.daily[stateRef.current.currentDay] = cloneValue(sourceDay);
    });
    if (shouldResetDailyReviewState()) {
      setStatus(`已保存：${stateRef.current.currentDay} 当日记录，需重新提交给 P2 审核。`);
      return;
    }
    setStatus(`已保存：${stateRef.current.currentDay} 当日记录。`);
  };

  const saveHandover = async () => {
    const week = requireCurrentWeek("请先加载本周后再保存交接记录。");
    if (!week) return;
    const source = cloneValue(week.handover);
    await withScopedWeeks((week) => {
      week.handover = cloneValue(source);
    });
    setStatus("已保存：交接记录。");
  };

  const saveReflection = async () => {
    const week = requireCurrentWeek("请先加载本周后再保存总结。");
    if (!week) return;
    const source = cloneValue(week.reflection);
    await withScopedWeeks((week) => {
      week.reflection = cloneValue(source);
    });
    setStatus(canApprove() && !canEditCurrentScopeData() ? "已保存：经理评语。" : "已保存：总结与反思。");
  };

  const addCreativePoster = async (files) => {
    const urls = await filesToDataUrls(files);
    if (!urls.length) return;
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.creative.posters = week.creative.posters.concat(urls);
    });
    await saveCreative();
  };

  const clearCreativePoster = async () => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.creative.posters = [];
    });
    await saveCreative();
  };

  const addDailyImages = async (kind, files) => {
    const day = stateRef.current.currentDay;
    if (!day) return;
    const urls = await filesToDataUrls(files);
    if (!urls.length) return;
    const next = cloneValue(stateRef.current);
    const week = next.weeks[next.currentWeekKey];
    if (!week) return;
    const target = ensureDayOnWeek(week, day);
    const config = DAILY_IMAGE_CONFIG[kind];
    if (!config) return;

    target[config.key] = target[config.key].concat(urls);
    if (shouldResetDailyReviewState(next)) {
      resetDailyReviewState(target, config.reviewKinds);
    }

    replaceState(next);
    await saveDaily();
  };

  const clearDailyField = (field) => {
    handleDailyFieldChange(field, "");
    setStatus("已清空当前内容，保存后需重新提交给 P2 审核。");
  };

  const clearDailyImages = async (kind) => {
    const day = stateRef.current.currentDay;
    if (!day) return;
    const config = DAILY_IMAGE_CONFIG[kind];
    if (!config) return;

    const next = cloneValue(stateRef.current);
    const week = next.weeks[next.currentWeekKey];
    if (!week) return;
    const target = ensureDayOnWeek(week, day);
    if (!hasImages(target[config.key])) return;

    target[config.key] = [];
    if (shouldResetDailyReviewState(next)) {
      resetDailyReviewState(target, config.reviewKinds);
    }

    replaceState(next);
    await saveDaily();
  };

  const addHandoverImages = async (files) => {
    const urls = await filesToDataUrls(files);
    if (!urls.length) return;
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.handover.photos = week.handover.photos.concat(urls);
    });
    await saveHandover();
  };

  const approveCreative = async () => {
    if (creativeApproveDisabled) {
      setStatus("请先填写创意策划内容或上传海报，再执行经理确认。", true);
      return;
    }
    let approved = false;
    await withScopedWeeks((week, _username, source) => {
      approved = stampApproval(source, week.creative.approval) || approved;
    });
    if (approved) setStatus("已确认：周三策划提交。");
  };

  const dailyApproveDisabled = dailyManagerSubmitDisabled;

  const _approveDaily = async (kind) => {
    const day = stateRef.current.currentDay;
    if (!day) {
      setStatus("请先选择日期后再执行经理确认。", true);
      return;
    }
    if (dailyApproveDisabled[kind]) {
      const blockerMessages = {
        checkIn: "请先填写签到时间，再执行经理确认。",
        checkOut: "请先填写签退时间，再执行经理确认。",
        grooming: "请先上传仪容仪表照片，再执行经理确认。",
        opening: "请先上传上班前卫生照片，再执行经理确认。",
        closing: "请先上传下班后卫生照片，再执行经理确认。",
        finance: "请先填写财务/库存数据或上传相关图片，再执行经理确认。",
        receipt: "请先填写签收信息或上传签收照片，再执行经理确认。",
      };
      setStatus(blockerMessages[kind] || "当前内容不足以执行经理确认。", true);
      return;
    }
    let approved = false;
    await withScopedWeeks((week, _username, source) => {
      const record = ensureDayOnWeek(week, day);
      const targetMap = {
        checkIn: record.approvals.checkIn,
        checkOut: record.approvals.checkOut,
        grooming: record.approvals.grooming,
        opening: record.approvals.opening,
        closing: record.approvals.closing,
        finance: record.approvals.finance,
        receipt: record.approvals.receipt,
      };
      approved = stampApproval(source, targetMap[kind] || emptyApproval()) || approved;
    });
    if (approved) {
      const labels = {
        checkIn: "签到时间",
        checkOut: "签退时间",
        grooming: "仪容仪表",
        opening: "上班前卫生",
        closing: "下班后卫生",
        finance: "财务与库存",
        receipt: "货品签收",
      };
      setStatus(`已确认：${labels[kind]}。`);
    }
  };

  const submitDailyManagerConfirmation = async (kind) => {
    const day = stateRef.current.currentDay;
    if (!day) {
      setStatus("请先选择日期后再执行 P2 确认。", true);
      return;
    }
    if (dailyManagerSubmitDisabled[kind]) {
      setStatus("请先补全该项 P2 确认说明后再提交。", true);
      return;
    }
    let approved = false;
    await withScopedWeeks((week, _username, source) => {
      const record = ensureDayOnWeek(week, day);
      const targetMap = {
        checkIn: record.approvals.checkIn,
        checkOut: record.approvals.checkOut,
        grooming: record.approvals.grooming,
        opening: record.approvals.opening,
        closing: record.approvals.closing,
        finance: record.approvals.finance,
        receipt: record.approvals.receipt,
        notes: record.approvals.notes,
      };
      approved = stampApproval(source, targetMap[kind] || emptyApproval()) || approved;
    });
    if (approved) {
      setStatus("已提交 P2 确认，等待 P3 回签。");
    }
  };

  const confirmDailyByStudent = async (kind) => {
    const day = stateRef.current.currentDay;
    if (!day) {
      setStatus("请先选择日期后再执行 P3 回签。", true);
      return;
    }
    if (dailyStudentConfirmDisabled[kind]) {
      setStatus("当前项目尚未完成 P2 确认，或已经完成 P3 回签。", true);
      return;
    }
    let confirmed = false;
    await withScopedWeeks((week, _username, source) => {
      const record = ensureDayOnWeek(week, day);
      const targetMap = {
        checkIn: record.studentConfirmations.checkIn,
        checkOut: record.studentConfirmations.checkOut,
        grooming: record.studentConfirmations.grooming,
        opening: record.studentConfirmations.opening,
        closing: record.studentConfirmations.closing,
        finance: record.studentConfirmations.finance,
        receipt: record.studentConfirmations.receipt,
        notes: record.studentConfirmations.notes,
      };
      confirmed = stampStudentConfirmation(source, targetMap[kind] || emptyApproval()) || confirmed;
    });
    if (confirmed) {
      setStatus("已完成 P3 回签确认。");
    }
  };

  const approveHandover = async () => {
    if (handoverApproveDisabled) {
      setStatus("请先填写交接说明、交接对象或上传交接照片，再执行经理确认。", true);
      return;
    }
    let approved = false;
    await withScopedWeeks((week, _username, source) => {
      approved = stampApproval(source, week.handover.approval) || approved;
    });
    if (approved) setStatus("已确认：交接班。");
  };

  const approveReflection = async () => {
    if (reflectionApproveDisabled) {
      setStatus("请先补充总结内容和经理评语，再执行最终确认。", true);
      return;
    }
    let approved = false;
    await withScopedWeeks((week, _username, source) => {
      approved = stampApproval(source, week.reflection.approval) || approved;
    });
    if (approved) setStatus("已确认：周总结。");
  };

  const handlePasswordSubmit = async () => runAction(async () => {
    const current = getCurrentUserRecord();
    if (!current || !trim(app.passwordForm.newPassword)) {
      throw new Error("新密码不能为空。");
    }
    const updated = {
      ...current,
      password: trim(app.passwordForm.newPassword),
      passwordUpdatedAt: new Date().toLocaleString(),
    };
    const response = await api.updateAccount(current.username, updated);
    applyState((draft) => {
      draft.users = draft.users.map((user) => (user.username === current.username ? normalizeUser(response.user) : user));
      draft.passwordForm.newPassword = "";
      draft.currentUser = {
        username: response.user.username,
        role: response.user.role,
        level: response.user.level,
        displayName: response.user.displayName,
      };
      syncEditForms(draft);
    });
    setStatus("密码已修改。");
  }, "密码修改失败，请稍后重试。");

  const handleNewUserChange = (field, value) => {
    applyState((draft) => {
      draft.newUserForm[field] = value;
    });
  };

  const handleCreateUser = async () => runAction(async () => {
    if (!canManageAccounts()) throw new Error("只有 P1 账号可以新增账号。");
    const form = stateRef.current.newUserForm;
    if (!trim(form.username) || !trim(form.displayName) || !trim(form.password)) {
      throw new Error("请完整填写新增账号信息。");
    }
    const payload = {
      username: trim(form.username),
      displayName: trim(form.displayName),
      password: trim(form.password),
      level: form.level,
      role: roleFromLevel(form.level),
      ownerType: form.level === "P3" ? "Student" : (form.level === "P2" ? "OM(Operations Manager)" : "Teacher"),
      nameUpdatedAt: new Date().toLocaleString(),
      passwordUpdatedAt: new Date().toLocaleString(),
    };
    const response = await api.createAccount(payload);
    applyState((draft) => {
      draft.users.push(normalizeUser(response.user));
      draft.users.sort((a, b) => a.username.localeCompare(b.username));
      draft.newUserForm = { username: "", displayName: "", password: "123456", level: "P3" };
      syncEditForms(draft);
    });
    setStatus(`已新增账号：${payload.username}（${levelLabel(payload.level)}）`);
  }, "新增账号失败，请稍后重试。");

  const handleEditUserSelect = (username) => {
    applyState((draft) => {
      draft.editUserId = username;
      syncEditForms(draft);
    });
  };

  const handleEditFormChange = (field, value) => {
    applyState((draft) => {
      draft.editForm[field] = value;
    });
  };

  const handleSaveUserEdit = async () => runAction(async () => {
    const target = stateRef.current.users.find((user) => user.username === stateRef.current.editUserId);
    if (!target) throw new Error("请先选择账号。");
    if (!trim(stateRef.current.editForm.displayName) || !trim(stateRef.current.editForm.password)) {
      throw new Error("姓名和密码不能为空。");
    }
    const updated = {
      ...target,
      displayName: trim(stateRef.current.editForm.displayName),
      password: trim(stateRef.current.editForm.password),
      nameUpdatedAt: target.displayName !== trim(stateRef.current.editForm.displayName) ? new Date().toLocaleString() : target.nameUpdatedAt,
      passwordUpdatedAt: target.password !== trim(stateRef.current.editForm.password) ? new Date().toLocaleString() : target.passwordUpdatedAt,
    };
    const response = await api.updateAccount(target.username, updated);
    applyState((draft) => {
      draft.users = draft.users.map((user) => (user.username === target.username ? normalizeUser(response.user) : user));
      if (draft.currentUser?.username === target.username) {
        draft.currentUser.displayName = response.user.displayName;
        draft.currentUser.role = response.user.role;
        draft.currentUser.level = response.user.level;
      }
      syncEditForms(draft);
    });
    setStatus(`已更新账号：${target.username}`);
  }, "账号修改失败，请稍后重试。");

  const handleDeleteUser = async () => runAction(async () => {
    if (!canManageAccounts()) throw new Error("只有 P1 账号可以删除账号。");
    const target = stateRef.current.users.find((user) => user.username === stateRef.current.editUserId);
    if (!target) throw new Error("请先选择需要删除的账号。");
    if (target.username === currentUser?.username) throw new Error("不能删除当前登录账号，请切换到其他 P1 账号后再操作。");
    const confirmed = window.confirm(`确认删除账号 ${target.displayName}（${target.username}）吗？删除后其周报数据也会一并移除。`);
    if (!confirmed) return;

    const before = cloneValue(stateRef.current);
    await api.deleteAccount(target.username);
    const remainingUsers = before.users.filter((user) => user.username !== target.username);
    const fallbackStudent = getStudentUsers(remainingUsers)[0]?.username || "";
    const deletedCurrentScope = before.activeScopeUser === target.username
      || trim(before.currentWeekKey).startsWith(`${target.username}::`);

    applyState((draft) => {
      draft.users = draft.users.filter((user) => user.username !== target.username);
      draft.currentSessionUsers = draft.currentSessionUsers.filter((username) => username !== target.username);
      Object.keys(draft.weeks).forEach((key) => {
        if (key.startsWith(`${target.username}::`)) delete draft.weeks[key];
      });
      if (draft.activeScopeUser === target.username) draft.activeScopeUser = fallbackStudent;
      if (draft.currentWeekKey.startsWith(`${target.username}::`)) {
        draft.currentWeekKey = "";
        draft.currentDay = "";
      }
      syncEditForms(draft);
    });

    if (deletedCurrentScope && fallbackStudent) {
      await loadWeekForCurrentScope(before.selectedWeekStart, `已删除账号：${target.displayName}（${target.username}）`);
      return;
    }
    setStatus(`已删除账号：${target.displayName}（${target.username}）`);
  }, "删除账号失败，请稍后重试。");

  const generateReportHtml = () => {
    if (!currentWeek) return "";
    return buildReportHtml({
      week: cloneValue(currentWeek),
      group: cloneValue(currentWeekGroup),
      scopeUser: resolveScopeUser(cloneValue(stateRef.current)),
    });
  };

  const handlePreviewReport = () => {
    if (!currentWeek) {
      setStatus("请先加载本周后再预览报告。", true);
      return;
    }
    const html = generateReportHtml();
    const success = openReportPreview(html);
    if (!success) {
      setStatus("浏览器拦截了弹窗，请允许弹窗后重试。", true);
    }
  };

  const handleExportWord = () => {
    if (!currentWeek) {
      setStatus("请先加载本周后再导出报告。", true);
      return;
    }
    const html = generateReportHtml();
    const scopeUser = resolveScopeUser(cloneValue(stateRef.current));
    exportReportWord(currentWeek, scopeUser, html);
    setStatus("已导出美化版 Word 实训报告（含图片）。");
  };

  if (app.booting) {
    return (
      <div className="site-shell flex min-h-screen items-center justify-center px-4 py-10">
        <div className="panel-card w-full max-w-3xl text-center">
          <p className="panel-eyebrow">Operations Arrival</p>
          <h1 className="section-title mt-3">系统初始化中...</h1>
          <p className="panel-lead mx-auto max-w-xl">正在连接本地 SQLite 数据与工程版前端资源，请稍候片刻。</p>
        </div>
      </div>
    );
  }

  const showWeekLoadingState = app.activeTab !== "accounts" && app.weekLoading && !currentWeek;
  const showEmptyWeekState = app.activeTab !== "accounts" && !app.weekLoading && !currentWeek;
  const studentUsers = getStudentUsers(app.users);
  const groupedStudentUsers = (() => {
    const groupedTokens = [
      currentWeek?.members.a || currentWeekGroup.a || "",
      currentWeek?.members.b || currentWeekGroup.b || "",
    ];
    const seen = new Set();
    return groupedTokens
      .map((token, index) => {
        const user = findStudentByToken(app.users, token);
        if (!user || seen.has(user.username)) return null;
        seen.add(user.username);
        return {
          username: user.username,
          displayName: user.displayName || user.username,
          groupLabel: index === 0 ? "本周学生 A" : "本周学生 B",
        };
      })
      .filter(Boolean);
  })();
  const prioritizedStudentUsers = [
    ...groupedStudentUsers.map((user) => studentUsers.find((item) => item.username === user.username)).filter(Boolean),
    ...studentUsers.filter((user) => !groupedStudentUsers.some((item) => item.username === user.username)),
  ];
  const resolvedScopeUser = currentUser
    ? (canViewAllScopes() ? resolveScopeUser(cloneValue(stateRef.current)) : currentUser.username)
    : "";
  const scopeUserRecord = studentUsers.find((user) => user.username === resolvedScopeUser) || currentUser;
  const activeTabItem = TAB_ITEMS.find((item) => item.key === app.activeTab);
  const dashboardTabItems = [
    { key: "creative", label: "创意策划" },
    { key: "daily", label: "日常运营" },
    { key: "handover", label: "班次交接" },
    { key: "reflection", label: "总结复盘" },
    { key: "accounts", label: "账号管理" },
  ];
  const activeDashboardTabLabel = dashboardTabItems.find((item) => item.key === app.activeTab)?.label || "运营工作台";
  const dashboardPublicNavItems = ["首页", "清单", "财务", "库存", "手册"];
  const pageTitle = app.currentUser ? "实训基地概览" : "饮品实训基地周运营系统";
  const pageSubtitle = app.currentUser
    ? `当前查看 ${scopeUserRecord ? `${scopeUserRecord.displayName || scopeUserRecord.username} 的轮值进度` : "本周运营数据"}。保持原有业务逻辑不变，只更新为 OpsMaster 风格工作台。`
    : "围绕学生轮值、日常运营、经理审核与周报导出的完整实训流程，提供更清晰的运营看板与执行入口。";
  const dashboardDate = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
  const formatCurrency = (value) => `¥${Number(value || 0).toFixed(2)}`;
  const checklistCompletion = currentDayData
    ? [
      Boolean(trim(currentDayData.checkIn) || trim(currentDayData.attendanceNote) || hasImages(currentDayData.leaveImgs)),
      Boolean(trim(currentDayData.checkOut) || trim(currentDayData.attendanceNote) || hasImages(currentDayData.leaveImgs)),
      hasImages(currentDayData.grooming),
      hasImages(currentDayData.openingPublic) || hasImages(currentDayData.openingBar),
      hasImages(currentDayData.closingPublic) || hasImages(currentDayData.closingBar),
      hasText(currentDayData.sales, currentDayData.cost, currentDayData.lossAmount, currentDayData.lossDesc, currentDayData.inventoryDesc)
        || hasImages(currentDayData.lossImgs)
        || hasImages(currentDayData.inventoryImgs),
      hasText(currentDayData.receiptDesc) || hasImages(currentDayData.receiptImgs),
      Boolean(trim(currentDayData.notes)),
    ]
    : Array.from({ length: 8 }, () => false);
  const completedCount = checklistCompletion.filter(Boolean).length;
  const totalCount = checklistCompletion.length || 8;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const dashboardStats = app.currentUser
    ? [
      {
        label: "今日任务进度",
        value: `${progressPercent}%`,
        meta: `${completedCount}/${totalCount} 已完成`,
        tone: "slate",
      },
      {
        label: "今日营业额",
        value: formatCurrency(currentDayData?.sales),
        meta: currentDayData ? `采购成本 ${formatCurrency(currentDayData.cost)}` : "待录入财务数据",
        tone: "emerald",
      },
      {
        label: "损耗预警",
        value: formatCurrency(currentDayData?.lossAmount),
        meta: currentDayData?.lossDesc ? "已填写损耗说明" : "暂未记录异常损耗",
        tone: "indigo",
      },
    ]
    : [
      { label: "双人协同", value: "2 人登录", meta: "同组学生一次登录同步周记录", tone: "emerald" },
      { label: "经理审核", value: "逐项确认", meta: "签到、卫生、财务与交接均可留痕", tone: "slate" },
      { label: "报告导出", value: "Word 周报", meta: "支持预览、打印与导出归档", tone: "indigo" },
    ];
  const teacherNoticeReceiptTargets = getTeacherNoticeReceiptTargets();
  const acknowledgedNoticeIds = app.currentUser
    ? app.teacherNotices
      .filter((notice) => hasTeacherNoticeBeenAcknowledged(notice))
      .map((notice) => notice.id)
    : [];
  const noticeBoardProps = {
    notices: app.teacherNotices,
    canCompose: currentUser?.level === "P1",
    composeForm: app.teacherNoticeForm,
    composePending: app.teacherNoticeSaving,
    activeActionId: app.teacherNoticeBusyId,
    acknowledgedNoticeIds,
    acknowledgementLabel: teacherNoticeReceiptTargets.length > 1 ? "本组信息收到" : "信息收到",
    onComposeImagesAdd: handleTeacherNoticeImagesAdd,
    onComposeImageRemove: handleTeacherNoticeImageRemove,
    onComposeSubmit: handleTeacherNoticeCreate,
    onAcknowledge: handleTeacherNoticeAcknowledge,
    onDeleteNotice: handleTeacherNoticeDelete,
  };
  const todoItems = [
    {
      title: currentWeek ? "继续填写本周日报" : "加载本周轮值",
      meta: currentWeek ? `${app.currentDay || currentWeek.startDate} 可继续录入` : `${app.selectedWeekStart} 起始`,
      tab: "daily",
      tone: "emerald",
      onClick: currentWeek ? undefined : handleLoadWeek,
    },
    {
      title: currentWeek ? "检查创意策划与物料" : "准备创意策划内容",
      meta: currentWeek ? renderApprovalText(currentWeek.creative.approval) : "营销、配方与采购内容待提交",
      tab: "creative",
      tone: "indigo",
    },
    {
      title: currentWeek ? "预览本周实训报告" : "等待生成周报",
      meta: currentWeek ? "可打开预览或导出 Word" : "加载周次后启用报告能力",
      tab: "reflection",
      tone: "slate",
      onClick: currentWeek ? handlePreviewReport : handleLoadWeek,
    },
  ];
  const activityItems = [
    { label: "当前会话", value: dashboardSessionInfo },
    { label: "教学周次", value: currentWeekGroup?.teachingWeek || "尚未设置" },
    { label: "轮值周期", value: currentWeek ? `${currentWeek.startDate} - ${currentWeek.endDate}` : "尚未加载本周" },
  ];
  const moduleContent = (
    <>
      {showWeekLoadingState ? (
        <section className="soft-card">
          <p className="module-kicker">Week Loading</p>
          <h2 className="section-title mt-2">正在加载本周</h2>
          <p className="status-line mt-4">系统正在读取当前周次与已上传图片，加载完成后会自动进入工作台，请稍候。</p>
        </section>
      ) : null}

      {showEmptyWeekState ? (
        <section className="soft-card">
          <p className="module-kicker">Weekly Preparation</p>
          <h2 className="section-title mt-2">请先加载本周</h2>
          <p className="status-line mt-4">左侧选择轮值起始日期后，点击“加载/创建本周”，再进入各业务模块录入或确认数据。</p>
        </section>
      ) : null}

      {app.activeTab === "creative" && currentWeek ? (
        <CreativeTab
          data={currentWeek.creative}
          approvalText={renderApprovalText(currentWeek.creative.approval)}
          editable={canEditCurrentScopeData()}
          approveDisabled={creativeApproveDisabled}
          onFieldChange={handleCreativeFieldChange}
          onSave={saveCreative}
          onAddPoster={addCreativePoster}
          onClearPoster={clearCreativePoster}
          onApprove={approveCreative}
        />
      ) : null}

      {app.activeTab === "daily" && currentWeek && currentDayData ? (
        <DailyTab
          dailyDateOptions={dailyDateOptions}
          currentDay={app.currentDay}
          data={currentDayData}
          approvals={{
            checkIn: renderApprovalText(currentDayData.approvals.checkIn),
            checkOut: renderApprovalText(currentDayData.approvals.checkOut),
            grooming: renderApprovalText(currentDayData.approvals.grooming),
            opening: renderApprovalText(currentDayData.approvals.opening),
            closing: renderApprovalText(currentDayData.approvals.closing),
            finance: renderApprovalText(currentDayData.approvals.finance),
            receipt: renderApprovalText(currentDayData.approvals.receipt),
            notes: renderApprovalText(currentDayData.approvals.notes),
          }}
          studentConfirmations={{
            checkIn: renderApprovalText(currentDayData.studentConfirmations.checkIn),
            checkOut: renderApprovalText(currentDayData.studentConfirmations.checkOut),
            grooming: renderApprovalText(currentDayData.studentConfirmations.grooming),
            opening: renderApprovalText(currentDayData.studentConfirmations.opening),
            closing: renderApprovalText(currentDayData.studentConfirmations.closing),
            finance: renderApprovalText(currentDayData.studentConfirmations.finance),
            receipt: renderApprovalText(currentDayData.studentConfirmations.receipt),
            notes: renderApprovalText(currentDayData.studentConfirmations.notes),
          }}
          editable={canEditDailyContent()}
          reviewerMode={canReviewDaily()}
          studentReviewMode={canStudentConfirmDaily()}
          canDeleteContent={currentUser?.level === "P3"}
          managerSubmitDisabled={dailyManagerSubmitDisabled}
          studentConfirmDisabled={dailyStudentConfirmDisabled}
          onDateChange={handleDailyDateChange}
          onFieldChange={handleDailyFieldChange}
          onClearField={clearDailyField}
          onManagerNoteChange={handleDailyManagerNoteChange}
          onAddImages={addDailyImages}
          onClearImages={clearDailyImages}
          onSave={saveDaily}
          onManagerSubmit={submitDailyManagerConfirmation}
          onStudentConfirm={confirmDailyByStudent}
        />
      ) : null}

      {app.activeTab === "handover" && currentWeek ? (
        <HandoverTab
          data={currentWeek.handover}
          statusText={renderApprovalText(currentWeek.handover.approval)}
          editable={canEditCurrentScopeData()}
          approveDisabled={handoverApproveDisabled}
          onFieldChange={handleHandoverFieldChange}
          onAddImages={addHandoverImages}
          onSave={saveHandover}
          onApprove={approveHandover}
        />
      ) : null}

      {app.activeTab === "reflection" && currentWeek ? (
        <ReflectionTab
          data={currentWeek.reflection}
          statusText={renderApprovalText(currentWeek.reflection.approval)}
          editable={canEditCurrentScopeData()}
          canApprove={canApprove()}
          approveDisabled={reflectionApproveDisabled}
          saveLabel={reflectionSaveLabel}
          onFieldChange={handleReflectionFieldChange}
          onSave={saveReflection}
          onApprove={approveReflection}
        />
      ) : null}

      {app.activeTab === "accounts" ? (
        <AccountsTab
          users={app.users}
          currentUser={currentUser}
          isTop={canManageAccounts()}
          passwordForm={app.passwordForm}
          newUserForm={app.newUserForm}
          editUserId={app.editUserId}
          editForm={app.editForm}
          onPasswordChange={(value) => applyState((draft) => { draft.passwordForm.newPassword = value; })}
          onSubmitPassword={handlePasswordSubmit}
          onNewUserChange={handleNewUserChange}
          onCreateUser={handleCreateUser}
          onEditUserSelect={handleEditUserSelect}
          onEditFormChange={handleEditFormChange}
          onSaveUserEdit={handleSaveUserEdit}
          onDeleteUser={handleDeleteUser}
          canDeleteSelected={canManageAccounts() && Boolean(app.editUserId) && app.editUserId !== currentUser?.username}
          deleteHint={deleteHint}
        />
      ) : null}
    </>
  );
  const loginProps = {
    loginForm: app.loginForm,
    loginMessage: app.loginMessage,
    loading: app.loading,
    onChange: handleLoginFormChange,
    onSubmit: handleLogin,
  };
  const sidebarProps = {
    currentUser,
    roleLabel: currentUser ? ({
      P1: "教学主管",
      P2: "运营经理",
      P3: "轮值学员",
    }[currentUser.level] || currentUser.level) : "",
    sessionInfo: dashboardSessionInfo,
    canViewAllScopes: canViewAllScopes(),
    groupedStudentUsers,
    studentUsers: prioritizedStudentUsers,
    activeScopeUser: resolvedScopeUser,
    weekStart: app.selectedWeekStart,
    weekEnd: currentWeek?.endDate || "",
    teachingWeekOptions: buildTeachingWeekOptions(),
    teachingWeek: currentWeekGroup?.teachingWeek || "",
    groupHint: describeTeachingWeek(currentWeekGroup),
    memberA: currentWeek?.members.a || currentWeekGroup.a || "",
    memberB: currentWeek?.members.b || currentWeekGroup.b || "",
    nextGroup: currentWeek?.nextGroup || currentWeekGroup.nextGroup || "",
    hasWeek: Boolean(currentWeek),
    canSaveGroup: canEditCurrentScopeData() && Boolean(currentWeek),
    canExportReport: Boolean(currentWeek),
    busy: app.weekLoading || app.loading,
    onScopeChange: handleScopeChange,
    onWeekStartChange: handleWeekStartChange,
    onLoadWeek: handleLoadWeek,
    onLogout: handleLogout,
    onTeachingWeekChange: handleTeachingWeekChange,
    onGroupChange: handleGroupChange,
    onSaveGroup: handleSaveGroup,
    onExportWord: handleExportWord,
    onPreviewReport: handlePreviewReport,
    statusMessage: app.statusMessage,
    statusError: app.statusError,
    editable: canEditCurrentScopeData(),
  };
/*
  return (
    <DashboardShell
      loggedIn={Boolean(app.currentUser)}
      dashboardDate={dashboardDate}
      statusLabel={currentWeek ? "杩愯惀涓? : "寰呭噯澶?"}
      pageTitle={pageTitle}
      pageSubtitle={pageSubtitle}
      dashboardStats={dashboardStats}
      noticeBoardProps={noticeBoardProps}
      todoItems={todoItems}
      activityItems={activityItems}
      publicNavItems={dashboardPublicNavItems}
      tabItems={dashboardTabItems}
      activeTab={app.activeTab}
      activeTabLabel={activeDashboardTabLabel}
      onTabChange={handleTabChange}
      sidebarProps={sidebarProps}
      moduleContent={moduleContent}
      onLoadWeek={handleLoadWeek}
      onPreviewReport={handlePreviewReport}
      canPreviewReport={Boolean(currentWeek)}
      loginProps={loginProps}
    />
  );
*/
  return (
    <DashboardShell
      loggedIn={Boolean(app.currentUser)}
      dashboardDate={dashboardDate}
      statusLabel={app.weekLoading || app.loading ? "加载中" : currentWeek ? "运营中" : "待准备"}
      pageTitle={pageTitle}
      pageSubtitle={pageSubtitle}
      dashboardStats={dashboardStats}
      noticeBoardProps={noticeBoardProps}
      todoItems={todoItems}
      activityItems={activityItems}
      publicNavItems={dashboardPublicNavItems}
      tabItems={dashboardTabItems}
      activeTab={app.activeTab}
      activeTabLabel={activeDashboardTabLabel}
      onTabChange={handleTabChange}
      sidebarProps={sidebarProps}
      moduleContent={moduleContent}
      onLoadWeek={handleLoadWeek}
      onPreviewReport={handlePreviewReport}
      canPreviewReport={Boolean(currentWeek)}
      busy={app.weekLoading || app.loading}
      loginProps={loginProps}
    />
  );
  // eslint-disable-next-line no-unreachable
  const useOpsMasterShell = import.meta.env.VITE_LEGACY_SHELL !== "1";

  if (useOpsMasterShell) {
    return (
      <DashboardShell
        loggedIn={Boolean(app.currentUser)}
        dashboardDate={dashboardDate}
        statusLabel={currentWeek ? "运营中" : "待准备"}
        pageTitle={pageTitle}
        pageSubtitle={pageSubtitle}
        dashboardStats={dashboardStats}
        noticeBoardProps={noticeBoardProps}
        todoItems={todoItems}
        activityItems={activityItems}
        publicNavItems={dashboardPublicNavItems}
        tabItems={dashboardTabItems}
        activeTab={app.activeTab}
        activeTabLabel={activeDashboardTabLabel}
        onTabChange={handleTabChange}
        sidebarProps={sidebarProps}
        moduleContent={moduleContent}
        onLoadWeek={handleLoadWeek}
        onPreviewReport={handlePreviewReport}
        canPreviewReport={Boolean(currentWeek)}
        loginProps={loginProps}
      />
    );
  }
  const publicNavItems = ["系统总览", "轮值实训", "运营执行", "经理审核", "报告导出"];
  const heroStats = app.currentUser
    ? [
      { label: "当前身份", value: currentUser ? `${currentUser.displayName} · ${levelLabel(currentUser.level)}` : "未登录" },
      { label: "当前查看", value: scopeUserRecord ? `${scopeUserRecord.displayName}（${scopeUserRecord.username}）` : "待选择学员" },
      { label: "教学周次", value: currentWeekGroup?.teachingWeek || "尚未选择" },
      { label: "轮值周期", value: currentWeek ? `${currentWeek.startDate} 至 ${currentWeek.endDate}` : "尚未加载本周" },
    ]
    : [
      { label: "双人协同", value: "支持同组 2 名学生一次登录并同步周度记录" },
      { label: "经理审核", value: "签到、签退、卫生、财务与交接均可逐项确认" },
      { label: "报告导出", value: "周结束后可预览与导出美化版 Word 实训报告" },
      { label: "数据留存", value: "工程版采用 SQLite 保存账号、周报与审核数据" },
    ];
  const featureCards = app.currentUser
    ? [
      {
        title: "本周排期",
        eyebrow: currentWeekGroup?.teachingWeek || "未设置教学周次",
        copy: currentWeek
          ? `当前轮值周期为 ${currentWeek.startDate} 至 ${currentWeek.endDate}，可直接进入 ${activeTabItem?.label || "当前模块"} 继续录入。`
          : "先从左侧加载或创建本周，系统才会开启本轮运营记录与报告导出。",
      },
      {
        title: "协同录入",
        eyebrow: currentUser?.level === "P3" ? "同组学生协作" : "管理视角查看",
        copy: sessionInfo,
      },
      {
        title: "报告状态",
        eyebrow: currentWeek ? "本周报告可生成" : "尚未生成报告",
        copy: currentWeek
          ? "当前周已经满足预览入口，可一键打开排版预览或导出 Word 报告。"
          : "加载本周并完成业务录入后，系统会自动开放报告预览与导出。",
      },
    ]
    : [
      {
        title: "双人周值录入",
        eyebrow: "学生协同体验",
        copy: "同组 2 个学生账号可以同时登录，本周的日常记录、海报与总结会自动同步到两位成员。",
      },
      {
        title: "运营经理逐项确认",
        eyebrow: "审核留痕",
        copy: "签到、签退、仪容仪表、卫生、财务与交接都能单独确认，保证业务流程与纸面要求一致。",
      },
      {
        title: "周报一键归档",
        eyebrow: "成果导出",
        copy: "系统会在周结束后生成美化版实训报告，支持预览、打印和导出 Word，适合课程留档与教学汇报。",
      },
    ];

  return (
    <div className="site-shell">
      <header className="site-header no-print">
        <div className="site-header-inner">
          <div className="brand-plate">
            <span>Drink Atelier</span>
            <strong>OPS<br />WEEKLY</strong>
            <i className="brand-mark" />
          </div>

          <div className="site-nav-wrap">
            <div className="utility-nav">
              <span><i className="utility-dot" />帮助</span>
              <span><i className="utility-dot" />中文</span>
              <span><i className="utility-dot" />实训报告</span>
              <span><i className="utility-dot" />{app.currentUser ? `登录 ${currentUser.displayName}` : "登录加入"}</span>
            </div>

            {app.currentUser ? (
              <TabNav items={TAB_ITEMS} activeTab={app.activeTab} onChange={handleTabChange} />
            ) : (
              <nav className="marketing-nav">
                {publicNavItems.map((item, index) => (
                  <span key={item} className={`marketing-link ${index === 0 ? "active" : ""}`}>{item}</span>
                ))}
              </nav>
            )}
          </div>
        </div>
      </header>

      <section className="hero-stage">
        <div className="hero-backdrop" style={{ backgroundImage: "url('/assets/luxury-hero.svg')" }} />
        <div className="hero-scrim" />

        <div className="hero-panel">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="hero-kicker">Luxury Hospitality Inspired Interface</p>
              <h1 className="hero-title">饮品生产性实训基地周运营系统</h1>
              <p className="hero-subtitle">
                参考国际高端酒店官网的视觉语气，将学生轮值、每日运营执行、经理确认与周报导出整合为一套更统一、更有品牌感的实训工作台。
              </p>

              <div className="hero-stat-grid">
                {heroStats.map((item) => (
                  <div key={item.label} className="hero-stat">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              {app.currentUser ? (
                <div className="hero-action-row">
                  <button className="btn-primary" type="button" onClick={handleLoadWeek}>
                    快速加载本周
                  </button>
                  <button className="btn-secondary" type="button" onClick={handlePreviewReport} disabled={!currentWeek}>
                    快速预览周报
                  </button>
                </div>
              ) : null}
            </div>

            {app.currentUser ? (
              <div className="hero-summary-card">
                <p className="panel-eyebrow !text-white/52">Current Session</p>
                <h3>运营工作台</h3>
                <div className="hero-summary-list">
                  <div className="hero-summary-item">
                    <span>当前会话</span>
                    <strong>{sessionInfo}</strong>
                  </div>
                  <div className="hero-summary-item">
                    <span>当前模块</span>
                    <strong>{activeTabItem?.label || "未选择模块"}</strong>
                  </div>
                  <div className="hero-summary-item">
                    <span>周报状态</span>
                    <strong>{currentWeek ? "已开放预览与 Word 导出" : "请先加载本周后启用报告功能"}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <LoginPanel
                loginForm={app.loginForm}
                loginMessage={app.loginMessage}
                loading={app.loading}
                onChange={handleLoginFormChange}
                onSubmit={handleLogin}
              />
            )}
          </div>
        </div>
      </section>

      <section className="feature-strip no-print">
        {featureCards.map((item) => (
          <article key={item.title} className="feature-card">
            <p>{item.eyebrow}</p>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>

      {app.currentUser ? (
        <section className="workspace-shell -mt-2 lg:-mt-4">
          <div className="workspace-grid">
            <Sidebar
              currentUser={currentUser}
              roleLabel={currentUser ? levelLabel(currentUser.level) : ""}
              sessionInfo={sessionInfo}
              canViewAllScopes={canViewAllScopes()}
              studentUsers={studentUsers}
              activeScopeUser={resolvedScopeUser}
              weekStart={app.selectedWeekStart}
              weekEnd={currentWeek?.endDate || ""}
              teachingWeekOptions={buildTeachingWeekOptions()}
              teachingWeek={currentWeekGroup?.teachingWeek || ""}
              groupHint={describeTeachingWeek(currentWeekGroup)}
              memberA={currentWeek?.members.a || currentWeekGroup.a || ""}
              memberB={currentWeek?.members.b || currentWeekGroup.b || ""}
              nextGroup={currentWeek?.nextGroup || currentWeekGroup.nextGroup || ""}
              hasWeek={Boolean(currentWeek)}
              canSaveGroup={canEditCurrentScopeData() && Boolean(currentWeek)}
              canExportReport={Boolean(currentWeek)}
              onScopeChange={handleScopeChange}
              onWeekStartChange={handleWeekStartChange}
              onLoadWeek={handleLoadWeek}
              onLogout={handleLogout}
              onTeachingWeekChange={handleTeachingWeekChange}
              onGroupChange={handleGroupChange}
              onSaveGroup={handleSaveGroup}
              onExportWord={handleExportWord}
              onPreviewReport={handlePreviewReport}
              statusMessage={app.statusMessage}
              statusError={app.statusError}
              editable={canEditCurrentScopeData()}
            />

            <main className="workspace-main">
              <p className="workspace-kicker">Curated Operations Suite</p>
              <h2 className="workspace-heading">{activeTabItem?.label || "运营工作台"}</h2>
              <p className="panel-lead">
                当前界面围绕周度实训动线组织，保留原有按钮与业务逻辑，但整体视觉改为更接近高端酒店官网的沉浸式展示方式。
              </p>

              <div className="mt-7">
                {showEmptyWeekState ? (
                  <section className="soft-card">
                    <p className="module-kicker">Weekly Preparation</p>
                    <h2 className="section-title mt-2">请先加载本周</h2>
                    <p className="status-line mt-4">左侧选择轮值起始日后，点击“加载/创建本周”，再进入各业务模块录入或确认数据。</p>
                  </section>
                ) : null}

                {app.activeTab === "creative" && currentWeek ? (
                  <CreativeTab
                    data={currentWeek.creative}
                    approvalText={renderApprovalText(currentWeek.creative.approval)}
                    editable={canEditCurrentScopeData()}
                    approveDisabled={creativeApproveDisabled}
                    onFieldChange={handleCreativeFieldChange}
                    onSave={saveCreative}
                    onAddPoster={addCreativePoster}
                    onClearPoster={clearCreativePoster}
                    onApprove={approveCreative}
                  />
                ) : null}

                {app.activeTab === "daily" && currentWeek && currentDayData ? (
                  <DailyTab
                    dailyDateOptions={dailyDateOptions}
                    currentDay={app.currentDay}
                    data={currentDayData}
                    approvals={{
                      checkIn: renderApprovalText(currentDayData.approvals.checkIn),
                      checkOut: renderApprovalText(currentDayData.approvals.checkOut),
                      grooming: renderApprovalText(currentDayData.approvals.grooming),
                      opening: renderApprovalText(currentDayData.approvals.opening),
                      closing: renderApprovalText(currentDayData.approvals.closing),
                      finance: renderApprovalText(currentDayData.approvals.finance),
                      receipt: renderApprovalText(currentDayData.approvals.receipt),
                      notes: renderApprovalText(currentDayData.approvals.notes),
                    }}
                    studentConfirmations={{
                      checkIn: renderApprovalText(currentDayData.studentConfirmations.checkIn),
                      checkOut: renderApprovalText(currentDayData.studentConfirmations.checkOut),
                      grooming: renderApprovalText(currentDayData.studentConfirmations.grooming),
                      opening: renderApprovalText(currentDayData.studentConfirmations.opening),
                      closing: renderApprovalText(currentDayData.studentConfirmations.closing),
                      finance: renderApprovalText(currentDayData.studentConfirmations.finance),
                      receipt: renderApprovalText(currentDayData.studentConfirmations.receipt),
                      notes: renderApprovalText(currentDayData.studentConfirmations.notes),
                    }}
                    editable={canEditDailyContent()}
                    reviewerMode={canReviewDaily()}
                    studentReviewMode={canStudentConfirmDaily()}
                    canDeleteContent={currentUser?.level === "P3"}
                    managerSubmitDisabled={dailyManagerSubmitDisabled}
                    studentConfirmDisabled={dailyStudentConfirmDisabled}
                    onDateChange={handleDailyDateChange}
                    onFieldChange={handleDailyFieldChange}
                    onClearField={clearDailyField}
                    onManagerNoteChange={handleDailyManagerNoteChange}
                    onAddImages={addDailyImages}
                    onClearImages={clearDailyImages}
                    onSave={saveDaily}
                    onManagerSubmit={submitDailyManagerConfirmation}
                    onStudentConfirm={confirmDailyByStudent}
                  />
                ) : null}

                {app.activeTab === "handover" && currentWeek ? (
                  <HandoverTab
                    data={currentWeek.handover}
                    statusText={renderApprovalText(currentWeek.handover.approval)}
                    editable={canEditCurrentScopeData()}
                    approveDisabled={handoverApproveDisabled}
                    onFieldChange={handleHandoverFieldChange}
                    onAddImages={addHandoverImages}
                    onSave={saveHandover}
                    onApprove={approveHandover}
                  />
                ) : null}

                {app.activeTab === "reflection" && currentWeek ? (
                  <ReflectionTab
                    data={currentWeek.reflection}
                    statusText={renderApprovalText(currentWeek.reflection.approval)}
                    editable={canEditCurrentScopeData()}
                    canApprove={canApprove()}
                    approveDisabled={reflectionApproveDisabled}
                    saveLabel={reflectionSaveLabel}
                    onFieldChange={handleReflectionFieldChange}
                    onSave={saveReflection}
                    onApprove={approveReflection}
                  />
                ) : null}

                {app.activeTab === "accounts" ? (
                  <AccountsTab
                    users={app.users}
                    currentUser={currentUser}
                    isTop={canManageAccounts()}
                    passwordForm={app.passwordForm}
                    newUserForm={app.newUserForm}
                    editUserId={app.editUserId}
                    editForm={app.editForm}
                    onPasswordChange={(value) => applyState((draft) => { draft.passwordForm.newPassword = value; })}
                    onSubmitPassword={handlePasswordSubmit}
                    onNewUserChange={handleNewUserChange}
                    onCreateUser={handleCreateUser}
                    onEditUserSelect={handleEditUserSelect}
                    onEditFormChange={handleEditFormChange}
                    onSaveUserEdit={handleSaveUserEdit}
                    onDeleteUser={handleDeleteUser}
                    canDeleteSelected={canManageAccounts() && Boolean(app.editUserId) && app.editUserId !== currentUser?.username}
                    deleteHint={deleteHint}
                  />
                ) : null}
              </div>
            </main>
          </div>
        </section>
      ) : null}

      <footer className="site-footer no-print">
        <div className="site-footer-inner">
          <div className="footer-grid">
            <div>
              <h3 className="footer-title">饮品实训周运营系统</h3>
              <p className="footer-copy">围绕周三策划、每日运营、交接班与总结反思建立统一留痕流程，让课程执行、审核和导出都保持同一套视觉与业务语言。</p>
            </div>
            <div>
              <h3 className="footer-title">核心模块</h3>
              <div className="footer-links">
                <div>周三策划提交</div>
                <div>每日打卡与运营执行</div>
                <div>交接班（次周三）</div>
                <div>总结与反思 / 账号管理</div>
              </div>
            </div>
            <div>
              <h3 className="footer-title">数据与交付</h3>
              <div className="footer-links">
                <div>本地 SQLite 持久化保存</div>
                <div>经理逐项确认与最终审核</div>
                <div>美化版周报预览与 Word 导出</div>
                <div>支持 Windows 一键启动与数据库迁移</div>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>Drink Atelier Weekly Operations System</span>
            <span>{app.currentUser ? `当前登录：${currentUser.displayName}（${currentUser.username}）` : "当前未登录，可使用学生或管理账号进入系统。"}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
