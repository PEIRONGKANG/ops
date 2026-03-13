import { useEffect, useRef, useState } from "react";

import { AccountsTab } from "./components/AccountsTab";
import { CourseConfigTab } from "./components/CourseConfigTab";
import { CreativeTab } from "./components/CreativeTab";
import { DailyTab } from "./components/DailyTab";
import { HandoverTab } from "./components/HandoverTab";
import { LoginPanel } from "./components/LoginPanel";
import { ReflectionTab } from "./components/ReflectionTab";
import { ResourcesTab } from "./components/ResourcesTab";
import { SchedulingTab } from "./components/SchedulingTab";
import { Sidebar } from "./components/Sidebar";
import { TabNav } from "./components/TabNav";
import { TAB_ITEMS } from "./lib/constants";
import {
  adjustToWednesday,
  addImagesWithLimit,
  applyTeachingWeekPreset,
  buildTeachingWeekOptions,
  createEmptyWeek,
  createEmptyWeekGroup,
  emptyApproval,
  ensureDayOnWeek,
  ensureWeekStructure,
  filesToDataUrls,
  findStudentByToken,
  getStudentUsers,
  getTeachingWeekPreset,
  getWeekDates,
  levelLabel,
  makeWeekKey,
  normalizeUser,
  PROCESS_ITEM_DEFINITIONS,
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
const DAY_LABELS = ["周三", "周四", "周五", "周六", "周日", "周一", "周二", "次周三(交接)"];
const STANDALONE_TABS = new Set(["accounts", "courseConfig", "scheduling", "resources"]);

function createEmptyFoundation() {
  return {
    terms: [],
    classes: [],
    courseBatches: [],
    groups: [],
    groupMembers: [],
    scheduleAssignments: [],
    resources: [],
  };
}

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
  foundation: createEmptyFoundation(),
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

function getDailyApprovalDefaults() {
  const processes = {};
  PROCESS_ITEM_DEFINITIONS.forEach((item) => {
    processes[item.key] = true;
  });
  return {
    checkIn: true,
    checkOut: true,
    grooming: true,
    receipt: true,
    processes,
  };
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

  const canManageFoundation = (source = stateRef.current) => canManageAccounts(source);

  const canEditCurrentScopeData = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    return !!user && (user.level === "P1" || user.level === "P3");
  };

  const canViewAllScopes = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    return !!user && (user.level === "P1" || user.level === "P2");
  };

  const resolveScopeUser = (source = stateRef.current) => {
    const user = getCurrentUserRecord(source);
    if (!user) return "";
    if (!canViewAllScopes(source)) return user.username;
    if (source.activeScopeUser && source.users.some((item) => item.username === source.activeScopeUser && item.level === "P3")) {
      return source.activeScopeUser;
    }
    const firstStudent = getStudentUsers(source.users)[0];
    source.activeScopeUser = firstStudent ? firstStudent.username : user.username;
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
    source.weeks[weekKey] = ensureWeekStructure(source.weeks[weekKey], startDate);
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
    const groupedUsers = [week.members?.a, week.members?.b]
      .map((item) => findStudentByToken(source.users, item))
      .filter(Boolean)
      .map((item) => item.username);
    if (groupedUsers.length) return Array.from(new Set(groupedUsers));
    const scope = resolveScopeUser(source);
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

  const loadWeekForCurrentScope = async (startRaw, statusMessage) => {
    const next = cloneValue(stateRef.current);
    const corrected = adjustToWednesday(startRaw || next.selectedWeekStart || todayISO());
    const scopeUser = resolveScopeUser(next);
    if (!scopeUser) {
      throw new Error("当前没有可查看的学生账号，请先确认账号数据。");
    }

    next.selectedWeekStart = corrected;
    const weekKey = makeWeekKey(corrected, scopeUser);
    const [weekResponse, groupResponse] = await Promise.all([
      api.fetchWeek(scopeUser, corrected),
      api.fetchWeekGroup(corrected),
    ]);
    next.weekGroups[corrected] = groupResponse.group || createEmptyWeekGroup();
    next.weeks[weekKey] = ensureWeekStructure(weekResponse.week || createEmptyWeek(corrected), corrected);
    ensureWeekInState(next, weekKey, corrected);
    await hydrateHandoverReference(next, weekKey, scopeUser);
    next.currentWeekKey = weekKey;
    const dateList = getWeekDates(corrected);
    next.currentDay = dateList.includes(next.currentDay) ? next.currentDay : dateList[0];
    ensureDayOnWeek(next.weeks[weekKey], next.currentDay);
    next.statusMessage = statusMessage || "已加载所选周次。";
    next.statusError = false;
    replaceState(next);
  };

  const loadFoundationData = async (statusMessage) => {
    const current = getCurrentUserRecord();
    if (!current) return;
    const foundation = await api.foundationBootstrap();
    applyState((draft) => {
      draft.foundation = foundation;
      if (statusMessage) {
        draft.statusMessage = statusMessage;
        draft.statusError = false;
      }
    });
  };

  const hydrateHandoverReference = async (source, weekKey, scopeUser) => {
    const week = source.weeks[weekKey];
    if (!week) return;

    const foundation = source.foundation || createEmptyFoundation();
    const memberships = (foundation.groupMembers || []).filter((item) => item.studentUsername === scopeUser);
    const groupIds = memberships.map((item) => item.groupId);
    if (!groupIds.length) {
      week.handover.inheritedDrinks = [];
      return;
    }

    const currentAssignment = (foundation.scheduleAssignments || [])
      .filter((item) => item.weekStartDate === week.startDate && (groupIds.includes(item.primaryGroupId) || groupIds.includes(item.secondaryGroupId)))
      .sort((a, b) => String(b.weekStartDate).localeCompare(String(a.weekStartDate)))[0];

    if (!currentAssignment) {
      week.handover.inheritedDrinks = [];
      return;
    }

    const previousAssignment = (foundation.scheduleAssignments || [])
      .filter((item) => item.batchId === currentAssignment.batchId && item.weekStartDate && item.weekStartDate < week.startDate)
      .sort((a, b) => String(b.weekStartDate).localeCompare(String(a.weekStartDate)))[0];

    if (!previousAssignment) {
      week.handover.inheritedDrinks = [];
      return;
    }

    const sourceMember = (foundation.groupMembers || []).find((item) => item.groupId === previousAssignment.primaryGroupId);
    if (!sourceMember) {
      week.handover.inheritedDrinks = [];
      return;
    }

    const response = await api.fetchWeek(sourceMember.studentUsername, previousAssignment.weekStartDate);
    const previousWeek = ensureWeekStructure(response.week || createEmptyWeek(previousAssignment.weekStartDate), previousAssignment.weekStartDate);
    week.handover.inheritedDrinks = previousWeek.creative.drinks.map((item, index) => ({
      id: item.id || `drink-${index + 1}`,
      name: item.name,
      type: item.type,
      inspiration: item.inspiration,
      ingredients: item.ingredients,
      ratio: item.ratio,
      steps: item.steps,
      productImages: item.productImages || [],
      posterImages: item.posterImages || [],
      specialMaterials: item.specialMaterials,
      notes: item.notes,
    }));
    week.handover.inheritedFrom = {
      batchName: previousAssignment.batchName || "",
      groupName: previousAssignment.primaryGroupName || "",
      weekStartDate: previousAssignment.weekStartDate || "",
      studentName: sourceMember.studentName || "",
    };
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const { users } = await api.bootstrap();
        const normalizedUsers = users.map(normalizeUser);
        const storedSession = loadStoredSession();
        const next = cloneValue(initialState);
        next.users = normalizedUsers;
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
          }
        }
        syncEditForms(next);
        next.booting = false;
        replaceState(next);
        if (next.currentUser) {
          api.setActor(next.currentUser.username);
          await loadFoundationData();
          await loadWeekForCurrentScope(next.selectedWeekStart, "已恢复上次会话。");
        } else {
          api.setActor("");
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
  const foundation = app.foundation || createEmptyFoundation();
  const visibleTabs = TAB_ITEMS.filter((item) => !item.levels || item.levels.includes(currentUser?.level));

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

  const dailyDateOptions = currentWeek
    ? getWeekDates(currentWeek.startDate).map((value, index) => ({
      value,
      label: `${value} ${DAY_LABELS[index]}`,
    }))
    : [];

  const creativeApproveDisabled = !canApprove() || !currentWeek
    || !(
      hasText(
        currentWeek.creative.survey.questions,
        currentWeek.creative.survey.resultSummary,
        currentWeek.creative.survey.analysis,
        ...currentWeek.creative.drinks.flatMap((item) => [
          item.name,
          item.type,
          item.inspiration,
          item.ingredients,
          item.ratio,
          item.steps,
          item.specialMaterials,
          item.notes,
        ]),
      )
      || hasImages(currentWeek.creative.posters)
    );

  const dailyApproveDisabled = currentDayData
    ? (() => {
      const processes = {};
      PROCESS_ITEM_DEFINITIONS.forEach((item) => {
        const process = currentDayData.processes[item.key];
        const hasExecution = hasText(process?.execution);
        const hasRequiredImages = !item.requiresImages || hasImages(process?.images);
        processes[item.key] = !canApprove() || !hasExecution || !hasRequiredImages;
      });
      return {
        checkIn: !canApprove() || !trim(currentDayData.checkIn),
        checkOut: !canApprove() || !trim(currentDayData.checkOut),
        grooming: !canApprove() || !hasImages(currentDayData.grooming),
        receipt: !canApprove() || !(hasText(currentDayData.receiptDesc) || hasImages(currentDayData.receiptImgs)),
        processes,
      };
    })()
    : getDailyApprovalDefaults();

  const handoverApproveDisabled = !canApprove() || !currentWeek
    || !(hasText(currentWeek.handover.summary, currentWeek.handover.nextGroup || currentWeek.nextGroup) || hasImages(currentWeek.handover.photos) || currentWeek.handover.inheritedDrinks.length);

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
        draft.loading = false;
        draft.loginForm.password = "";
        draft.loginForm.secondPassword = "";
        draft.loginMessage = "";
      });

      api.setActor(first.user.username);
      await loadFoundationData();

      await loadWeekForCurrentScope(
        todayISO(),
        sessionUsers.length > 1
          ? "双人登录成功。已自动加载本周轮值并同步到本组账号。"
          : "登录成功。已自动加载本周轮值。",
      );
    } catch (error) {
      applyState((draft) => {
        draft.loading = false;
        draft.loginMessage = error.message || "登录失败。";
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    api.setActor("");
    replaceState({
      ...cloneValue(initialState),
      users: stateRef.current.users,
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
    await loadWeekForCurrentScope(
      corrected,
      raw !== corrected ? `已自动调整到最近周三：${corrected}` : "已加载所选周次。",
    );
  }, "加载周次失败，请稍后重试。");

  const handleScopeChange = async (scopeUser) => runAction(async () => {
    applyState((draft) => {
      draft.activeScopeUser = scopeUser;
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

  const handleCreativeSurveyChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.creative.survey[field] = value;
    });
  };

  const handleCreativeDrinkChange = (index, field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.creative.drinks[index][field] = value;
    });
  };

  const handleCreativeProcurementItemChange = (index, field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      const item = week.creative.procurementItems[index];
      if (!item) return;
      item[field] = value;
      if (field === "quantity" || field === "unitPrice") {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        if (Number.isFinite(quantity) && Number.isFinite(unitPrice)) {
          item.subtotal = quantity && unitPrice ? (quantity * unitPrice).toFixed(2) : "";
        }
      }
    });
  };

  const handleAddCreativeProcurementItem = () => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.creative.procurementItems.push({
        name: "",
        spec: "",
        quantity: "",
        unitPrice: "",
        subtotal: "",
        notes: "",
      });
    });
  };

  const handleRemoveCreativeProcurementItem = (index) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      if (week.creative.procurementItems.length === 1) {
        week.creative.procurementItems[0] = {
          name: "",
          spec: "",
          quantity: "",
          unitPrice: "",
          subtotal: "",
          notes: "",
        };
        return;
      }
      week.creative.procurementItems.splice(index, 1);
    });
  };

  const handleDailyBasicChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week || !draft.currentDay) return;
      ensureDayOnWeek(week, draft.currentDay)[field] = value;
    });
  };

  const handleDailyProcessChange = (key, field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week || !draft.currentDay) return;
      const dayData = ensureDayOnWeek(week, draft.currentDay);
      dayData.processes[key][field] = value;

      if (key === "19" && field === "execution") dayData.inventoryDesc = value;
      if (key === "20" && field === "execution") dayData.notes = value;
      if (key === "21" && field === "execution") dayData.lossDesc = value;
      if (key === "23" && field === "issues") dayData.notes = value;
    });
  };

  const handleDailyReportChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week || !draft.currentDay) return;
      const dayData = ensureDayOnWeek(week, draft.currentDay);
      dayData.dailyReport[field] = value;
      if (field === "issues") dayData.notes = value;
    });
  };

  const handleDailyReceiptChange = (field, value) => {
    handleDailyBasicChange(field, value);
  };

  const handleHandoverFieldChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.handover[field] = value;
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
      week.creative.posters = addImagesWithLimit(week.creative.posters, urls, 8);
    });
    await saveCreative();
  };

  const addCreativeSurveyImages = async (files) => {
    const urls = await filesToDataUrls(files);
    if (!urls.length) return;
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.creative.survey.resultImages = addImagesWithLimit(week.creative.survey.resultImages, urls, 5);
    });
    await saveCreative();
  };

  const addCreativeDrinkImages = async (index, kind, files) => {
    const urls = await filesToDataUrls(files);
    if (!urls.length) return;
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      const drink = week.creative.drinks[index];
      if (!drink) return;
      if (kind === "productImages") {
        drink.productImages = addImagesWithLimit(drink.productImages, urls, 5);
      }
      if (kind === "posterImages") {
        drink.posterImages = addImagesWithLimit(drink.posterImages, urls, 5);
      }
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

  const addDailyGroomingImages = async (files) => {
    const day = stateRef.current.currentDay;
    if (!day) return;
    const urls = await filesToDataUrls(files);
    if (!urls.length) return;
    const next = cloneValue(stateRef.current);
    const week = next.weeks[next.currentWeekKey];
    if (!week) return;
    const target = ensureDayOnWeek(week, day);
    target.grooming = addImagesWithLimit(target.grooming, urls, 5);
    replaceState(next);
    await saveDaily();
  };

  const addDailyProcessImages = async (processKey, files) => {
    const day = stateRef.current.currentDay;
    if (!day) return;
    const urls = await filesToDataUrls(files);
    if (!urls.length) return;
    const next = cloneValue(stateRef.current);
    const week = next.weeks[next.currentWeekKey];
    if (!week) return;
    const target = ensureDayOnWeek(week, day);
    target.processes[processKey].images = addImagesWithLimit(target.processes[processKey].images, urls, 5);
    if (processKey === "13") {
      target.openingPublic = target.processes[processKey].images.slice();
      target.openingBar = [];
    }
    if (processKey === "18") {
      target.closingPublic = target.processes[processKey].images.slice();
      target.closingBar = [];
    }
    if (processKey === "19") {
      target.inventoryImgs = target.processes[processKey].images.slice();
    }
    if (processKey === "21") {
      target.lossImgs = target.processes[processKey].images.slice();
    }

    replaceState(next);
    await saveDaily();
  };

  const addDailyReceiptImages = async (files) => {
    const day = stateRef.current.currentDay;
    if (!day) return;
    const urls = await filesToDataUrls(files);
    if (!urls.length) return;
    const next = cloneValue(stateRef.current);
    const week = next.weeks[next.currentWeekKey];
    if (!week) return;
    const target = ensureDayOnWeek(week, day);
    target.receiptImgs = addImagesWithLimit(target.receiptImgs, urls, 5);
    replaceState(next);
    await saveDaily();
  };

  const addHandoverImages = async (files) => {
    const urls = await filesToDataUrls(files);
    if (!urls.length) return;
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week) return;
      week.handover.photos = addImagesWithLimit(week.handover.photos, urls, 5);
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

  const approveDaily = async (kind) => {
    const day = stateRef.current.currentDay;
    if (!day) {
      setStatus("请先选择日期后再执行经理确认。", true);
      return;
    }
    const isProcess = PROCESS_ITEM_DEFINITIONS.some((item) => item.key === String(kind));
    const disabled = isProcess ? dailyApproveDisabled.processes[kind] : dailyApproveDisabled[kind];
    if (disabled) {
      const blockerMessages = {
        checkIn: "请先填写签到时间，再执行经理确认。",
        checkOut: "请先填写签退时间，再执行经理确认。",
        grooming: "请先上传仪容仪表照片，再执行经理确认。",
        receipt: "请先填写签收信息或上传签收照片，再执行经理确认。",
      };
      if (isProcess) {
        const definition = PROCESS_ITEM_DEFINITIONS.find((item) => item.key === String(kind));
        setStatus(`请先补充“${definition?.shortTitle || kind}”的执行说明${definition?.requiresImages ? "并上传图片" : ""}，再执行经理确认。`, true);
        return;
      }
      setStatus(blockerMessages[kind] || "当前内容不足以执行经理确认。", true);
      return;
    }
    let approved = false;
    await withScopedWeeks((week, _username, source) => {
      const record = ensureDayOnWeek(week, day);
      if (isProcess) {
        approved = stampApproval(source, record.processes[kind].approval) || approved;
        return;
      }
      const targetMap = {
        checkIn: record.approvals.checkIn,
        checkOut: record.approvals.checkOut,
        grooming: record.approvals.grooming,
        receipt: record.approvals.receipt,
      };
      approved = stampApproval(source, targetMap[kind] || emptyApproval()) || approved;
    });
    if (approved) {
      const labels = {
        checkIn: "签到时间",
        checkOut: "签退时间",
        grooming: "仪容仪表",
        receipt: "货品签收",
      };
      if (isProcess) {
        const definition = PROCESS_ITEM_DEFINITIONS.find((item) => item.key === String(kind));
        setStatus(`已确认：${definition?.title || kind}。`);
      } else {
        setStatus(`已确认：${labels[kind]}。`);
      }
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
      week.handover.confirmation = {
        status: "已确认",
        by: source.currentUser?.displayName || source.currentUser?.username || "",
        time: new Date().toLocaleString(),
      };
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

  const handleCreateTerm = async (payload) => runAction(async () => {
    if (!canManageFoundation()) throw new Error("只有 P1 账号可以维护基础配置。");
    if (!trim(payload.code) || !trim(payload.name)) throw new Error("请完整填写学期编码和名称。");
    await api.createTerm(payload);
    await loadFoundationData("已新增学期。");
  }, "新增学期失败，请稍后重试。");

  const handleDeleteTerm = async (termId) => runAction(async () => {
    if (!window.confirm("确认删除这个学期吗？相关课程批次将失去学期关联。")) return;
    await api.deleteTerm(termId);
    await loadFoundationData("已删除学期。");
  }, "删除学期失败，请稍后重试。");

  const handleCreateClassItem = async (payload) => runAction(async () => {
    if (!canManageFoundation()) throw new Error("只有 P1 账号可以维护基础配置。");
    if (!trim(payload.code) || !trim(payload.name)) throw new Error("请完整填写班级编码和名称。");
    await api.createClassItem(payload);
    await loadFoundationData("已新增班级。");
  }, "新增班级失败，请稍后重试。");

  const handleDeleteClassItem = async (classId) => runAction(async () => {
    if (!window.confirm("确认删除这个班级吗？相关课程批次中的班级关联也会一并移除。")) return;
    await api.deleteClassItem(classId);
    await loadFoundationData("已删除班级。");
  }, "删除班级失败，请稍后重试。");

  const handleCreateCourseBatch = async (payload) => runAction(async () => {
    if (!canManageFoundation()) throw new Error("只有 P1 账号可以维护基础配置。");
    if (!trim(payload.name) || !trim(payload.courseName)) throw new Error("请完整填写课程批次和课程名称。");
    await api.createCourseBatch(payload);
    await loadFoundationData("已新增课程批次。");
  }, "新增课程批次失败，请稍后重试。");

  const handleDeleteCourseBatch = async (batchId) => runAction(async () => {
    if (!window.confirm("确认删除这个课程批次吗？其下分组、排班和绑定关系也会一并删除。")) return;
    await api.deleteCourseBatch(batchId);
    await loadFoundationData("已删除课程批次。");
  }, "删除课程批次失败，请稍后重试。");

  const handleCreateGroup = async (payload) => runAction(async () => {
    if (!canManageFoundation()) throw new Error("只有 P1 账号可以维护基础配置。");
    if (!payload.batchId || !trim(payload.name) || !payload.sequence) throw new Error("请完整填写分组信息。");
    await api.createGroup(payload);
    await loadFoundationData("已新增分组。");
  }, "新增分组失败，请稍后重试。");

  const handleDeleteGroup = async (groupId) => runAction(async () => {
    if (!window.confirm("确认删除这个分组吗？该组成员绑定和相关排班会一并移除。")) return;
    await api.deleteGroup(groupId);
    await loadFoundationData("已删除分组。");
  }, "删除分组失败，请稍后重试。");

  const handleCreateGroupMember = async (payload) => runAction(async () => {
    if (!canManageFoundation()) throw new Error("只有 P1 账号可以维护基础配置。");
    if (!payload.groupId || !trim(payload.studentUsername)) throw new Error("请选择分组和学生账号。");
    await api.createGroupMember(payload);
    await loadFoundationData("已绑定组员。");
  }, "绑定组员失败，请稍后重试。");

  const handleDeleteGroupMember = async (memberId) => runAction(async () => {
    await api.deleteGroupMember(memberId);
    await loadFoundationData("已解除组员绑定。");
  }, "删除组员绑定失败，请稍后重试。");

  const handleCreateScheduleAssignment = async (payload) => runAction(async () => {
    if (!canManageFoundation()) throw new Error("只有 P1 账号可以维护基础配置。");
    if (!payload.batchId || !trim(payload.teachingWeek) || !payload.primaryGroupId) {
      throw new Error("请至少填写课程批次、教学周次和本周轮值组。");
    }
    await api.createScheduleAssignment(payload);
    await loadFoundationData("已新增排班。");
  }, "新增排班失败，请稍后重试。");

  const handleDeleteScheduleAssignment = async (assignmentId) => runAction(async () => {
    await api.deleteScheduleAssignment(assignmentId);
    await loadFoundationData("已删除排班。");
  }, "删除排班失败，请稍后重试。");

  const handleCreateResource = async (payload) => runAction(async () => {
    if (!canManageFoundation()) throw new Error("只有 P1 账号可以维护基础配置。");
    if (!trim(payload.title) || !trim(payload.category)) throw new Error("请填写资源标题和分类。");
    if (!trim(payload.externalUrl) && !trim(payload.fileData)) {
      throw new Error("请至少提供一个外部链接或上传一个文件。");
    }
    await api.createResource(payload);
    await loadFoundationData("已新增资源。");
  }, "新增资源失败，请稍后重试。");

  const handleDeleteResource = async (resourceId) => runAction(async () => {
    await api.deleteResource(resourceId);
    await loadFoundationData("已删除资源。");
  }, "删除资源失败，请稍后重试。");

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

  const showEmptyWeekState = !STANDALONE_TABS.has(app.activeTab) && !currentWeek;
  const studentUsers = getStudentUsers(app.users);
  const resolvedScopeUser = currentUser
    ? (canViewAllScopes() ? resolveScopeUser(cloneValue(stateRef.current)) : currentUser.username)
    : "";
  const scopeUserRecord = studentUsers.find((user) => user.username === resolvedScopeUser) || currentUser;
  const activeTabItem = visibleTabs.find((item) => item.key === app.activeTab) || visibleTabs[0];
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
              <TabNav items={visibleTabs} activeTab={app.activeTab} onChange={handleTabChange} />
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
                    onSurveyChange={handleCreativeSurveyChange}
                    onAddSurveyImages={addCreativeSurveyImages}
                    onDrinkChange={handleCreativeDrinkChange}
                    onAddDrinkImages={addCreativeDrinkImages}
                    onSave={saveCreative}
                    onAddPoster={addCreativePoster}
                    onClearPoster={clearCreativePoster}
                    onProcurementItemChange={handleCreativeProcurementItemChange}
                    onAddProcurementItem={handleAddCreativeProcurementItem}
                    onRemoveProcurementItem={handleRemoveCreativeProcurementItem}
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
                      receipt: renderApprovalText(currentDayData.approvals.receipt),
                      processes: Object.fromEntries(
                        PROCESS_ITEM_DEFINITIONS.map((item) => [
                          item.key,
                          renderApprovalText(currentDayData.processes[item.key].approval),
                        ]),
                      ),
                    }}
                    editable={canEditCurrentScopeData()}
                    approveDisabled={dailyApproveDisabled}
                    onDateChange={handleDailyDateChange}
                    onBasicChange={handleDailyBasicChange}
                    onProcessChange={handleDailyProcessChange}
                    onAddProcessImages={addDailyProcessImages}
                    onAddGroomingImages={addDailyGroomingImages}
                    onReceiptChange={handleDailyReceiptChange}
                    onAddReceiptImages={addDailyReceiptImages}
                    onReportChange={handleDailyReportChange}
                    onSave={saveDaily}
                    onApprove={approveDaily}
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

                {app.activeTab === "courseConfig" ? (
                  <CourseConfigTab
                    terms={foundation.terms}
                    classes={foundation.classes}
                    courseBatches={foundation.courseBatches}
                    onCreateTerm={handleCreateTerm}
                    onDeleteTerm={handleDeleteTerm}
                    onCreateClass={handleCreateClassItem}
                    onDeleteClass={handleDeleteClassItem}
                    onCreateBatch={handleCreateCourseBatch}
                    onDeleteBatch={handleDeleteCourseBatch}
                  />
                ) : null}

                {app.activeTab === "scheduling" ? (
                  <SchedulingTab
                    courseBatches={foundation.courseBatches}
                    groups={foundation.groups}
                    groupMembers={foundation.groupMembers}
                    scheduleAssignments={foundation.scheduleAssignments}
                    students={studentUsers}
                    onCreateGroup={handleCreateGroup}
                    onDeleteGroup={handleDeleteGroup}
                    onCreateGroupMember={handleCreateGroupMember}
                    onDeleteGroupMember={handleDeleteGroupMember}
                    onCreateScheduleAssignment={handleCreateScheduleAssignment}
                    onDeleteScheduleAssignment={handleDeleteScheduleAssignment}
                  />
                ) : null}

                {app.activeTab === "resources" ? (
                  <ResourcesTab
                    resources={foundation.resources}
                    editable={canManageFoundation()}
                    onCreateResource={handleCreateResource}
                    onDeleteResource={handleDeleteResource}
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
