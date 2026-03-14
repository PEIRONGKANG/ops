import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faBookOpen,
  faClipboardList,
  faDownload,
  faFileArrowDown,
  faFileLines,
  faLightbulb,
  faMagnifyingGlass,
  faMugHot,
  faRightFromBracket,
  faRightLeft,
  faUserGear,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

import { AccountsTab } from "./components/AccountsTab";
import { CreativeTab } from "./components/CreativeTab";
import { DailyTab } from "./components/DailyTab";
import { HandoverTab } from "./components/HandoverTab";
import { LoginPanel } from "./components/LoginPanel";
import { ReflectionTab } from "./components/ReflectionTab";
import { Sidebar } from "./components/Sidebar";
import { TabNav } from "./components/TabNav";
import { NAV_SECTIONS, TAB_ITEMS } from "./lib/constants";
import {
  adjustToWednesday,
  applyTeachingWeekPreset,
  buildTeachingWeekOptions,
  createEmptyWeek,
  createEmptyWeekGroup,
  ensureDayOnWeek,
  filesToDataUrls,
  findStudentByToken,
  getStudentUsers,
  getTeachingWeekPreset,
  getWeekDates,
  levelLabel,
  makeWeekKey,
  normalizeUser,
  renderApprovalText,
  roleFromLevel,
  describeTeachingWeek,
  syncWeekGroupForWeek,
  todayISO,
  trim,
} from "./lib/core";
import {
  canEditDailyField,
  canSubmitManagerReview,
  canUploadDailyImages,
  getDailyRoleCapabilities,
  renderManagerReviewText,
  submitManagerReview,
} from "./lib/dailyWorkflow.js";
import { buildReportHtml, exportReportWord, openReportPreview } from "./lib/report";
import { api } from "./services/api";


const SESSION_KEY = "ops_training_ops_react_session_v1";
const DAY_LABELS = ["周三", "周四", "周五", "周六", "周日", "周一", "周二", "次周三(交接)"];

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
  activeTab: "overview",
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

function App() {
  const [app, setApp] = useState(initialState);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const stateRef = useRef(initialState);
  const weekLoadRequestRef = useRef(0);

  useEffect(() => {
    stateRef.current = app;
  }, [app]);

  useEffect(() => {
    if (!app.currentUser) {
      setMobileNavOpen(false);
    }
  }, [app.currentUser]);

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
    const snapshot = cloneValue(stateRef.current);
    const corrected = adjustToWednesday(startRaw || snapshot.selectedWeekStart || todayISO());
    const scopeUser = resolveScopeUser(snapshot);
    if (!scopeUser) {
      throw new Error("当前没有可查看的学生账号，请先确认账号数据。");
    }

    const requestId = ++weekLoadRequestRef.current;
    const requestUser = snapshot.currentUser?.username || "";
    const weekKey = makeWeekKey(corrected, scopeUser);
    const [weekResponse, groupResponse] = await Promise.all([
      api.fetchWeek(scopeUser, corrected),
      api.fetchWeekGroup(corrected),
    ]);

    if (requestId !== weekLoadRequestRef.current) return;
    if ((stateRef.current.currentUser?.username || "") !== requestUser) return;

    const next = cloneValue(stateRef.current);
    next.selectedWeekStart = corrected;
    next.weekGroups[corrected] = groupResponse.group || createEmptyWeekGroup();
    next.weeks[weekKey] = weekResponse.week || createEmptyWeek(corrected);
    ensureWeekInState(next, weekKey, corrected);
    next.currentWeekKey = weekKey;
    const dateList = getWeekDates(corrected);
    next.currentDay = dateList.includes(next.currentDay) ? next.currentDay : dateList[0];
    ensureDayOnWeek(next.weeks[weekKey], next.currentDay);
    next.statusMessage = statusMessage || "已加载所选周次。";
    next.statusError = false;
    replaceState(next);
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
          await loadWeekForCurrentScope(next.selectedWeekStart, "已恢复上次会话。");
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
  const dailyRole = getDailyRoleCapabilities(currentUser?.level);

  const sessionInfo = (() => {
    if (!currentUser) return "当前未登录。";
    if (currentUser.level !== "P3") return `当前账号：${currentUser.displayName}（${currentUser.username}）`;
    const sessionUsers = getCurrentSessionUsers();
    const labels = sessionUsers.map((username) => {
      const user = app.users.find((item) => item.username === username);
      return user ? `${user.displayName}（${user.username}）` : username;
    });
    if (labels.length > 1) {
      return `本次会话：${labels.join("、")}`;
    }
    return `当前账号：${labels[0] || `${currentUser.displayName}（${currentUser.username}）`}`;
  })();

  const dailyDateOptions = currentWeek
    ? getWeekDates(currentWeek.startDate).map((value, index) => ({
      value,
      label: `${value} ${DAY_LABELS[index]}`,
    }))
    : [];

  const creativeApproveDisabled = !canApprove() || !currentWeek
    || !(hasText(currentWeek.creative.marketing, currentWeek.creative.recipe, currentWeek.creative.procurement) || hasImages(currentWeek.creative.posters));

  const dailyManagerReviewDisabled = !currentDayData || !canSubmitManagerReview(currentUser?.level, currentDayData);
  const dailyManagerReviewStatus = currentDayData
    ? renderManagerReviewText(currentDayData.managerReview)
    : "待 P2 确认";

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
        draft.activeTab = "overview";
        draft.loading = false;
        draft.loginForm.password = "";
        draft.loginForm.secondPassword = "";
        draft.loginMessage = "";
      });
      setMobileNavOpen(false);

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
    weekLoadRequestRef.current += 1;
    localStorage.removeItem(SESSION_KEY);
    setMobileNavOpen(false);
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
    setMobileNavOpen(false);
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
      if (!canEditDailyField(draft.currentUser?.level, field)) return;
      ensureDayOnWeek(week, draft.currentDay)[field] = value;
    });
  };

  const handleManagerReviewFieldChange = (field, value) => {
    applyState((draft) => {
      const week = draft.weeks[draft.currentWeekKey];
      if (!week || !draft.currentDay) return;
      if (!getDailyRoleCapabilities(draft.currentUser?.level).canEditManagerReview) return;
      ensureDayOnWeek(week, draft.currentDay).managerReview[field] = value;
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
    if (!canUploadDailyImages(stateRef.current.currentUser?.level)) {
      setStatus("P2 仅查看 P3 上传的执行照片，不需要新增图片。", true);
      return;
    }
    const urls = await filesToDataUrls(files);
    if (!urls.length) return;
    const next = cloneValue(stateRef.current);
    const week = next.weeks[next.currentWeekKey];
    if (!week) return;
    const target = ensureDayOnWeek(week, day);

    if (kind === "groom") {
      target.grooming = target.grooming.concat(urls);
    }
    if (kind === "openingPublic") {
      target.openingPublic = target.openingPublic.concat(urls);
    }
    if (kind === "openingBar") {
      target.openingBar = target.openingBar.concat(urls);
    }
    if (kind === "closingPublic") {
      target.closingPublic = target.closingPublic.concat(urls);
    }
    if (kind === "closingBar") {
      target.closingBar = target.closingBar.concat(urls);
    }
    if (kind === "loss") {
      target.lossImgs = target.lossImgs.concat(urls);
    }
    if (kind === "inventory") {
      target.inventoryImgs = target.inventoryImgs.concat(urls);
    }
    if (kind === "receipt") {
      target.receiptImgs = target.receiptImgs.concat(urls);
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

  const submitDailyReview = async () => {
    const day = stateRef.current.currentDay;
    if (!day) {
      setStatus("请先选择日期后再提交 P2 确认。", true);
      return;
    }
    const actor = getCurrentUserRecord();
    const sourceWeek = requireCurrentWeek("请先加载本周后再提交 P2 确认。");
    if (!sourceWeek || !actor) return;
    const sourceDay = ensureDayOnWeek(sourceWeek, day);
    if (!canSubmitManagerReview(actor.level, sourceDay)) {
      setStatus("请先补全 P2 确认说明，并确认 P3 已提交打卡、卫生、财务库存与签收相关内容。", true);
      return;
    }
    await withScopedWeeks((week, _username, source) => {
      const record = ensureDayOnWeek(week, day);
      submitManagerReview(record, getCurrentUserRecord(source), new Date().toLocaleString());
    });
    setStatus(`已提交：${day} 的 P2 确认。`);
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

  const studentUsers = getStudentUsers(app.users);
  const resolvedScopeUser = currentUser
    ? (canViewAllScopes() ? resolveScopeUser(cloneValue(stateRef.current)) : currentUser.username)
    : "";
  const scopeUserRecord = studentUsers.find((user) => user.username === resolvedScopeUser) || currentUser;
  const activePage = currentUser ? app.activeTab : "overview";
  const tabMap = Object.fromEntries(TAB_ITEMS.map((item) => [item.key, item]));
  const navIconMap = {
    overview: faBookOpen,
    creative: faLightbulb,
    daily: faClipboardList,
    handover: faRightLeft,
    reflection: faFileLines,
    reports: faFileArrowDown,
    accounts: faUserGear,
  };
  const navSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((key) => ({
      ...tabMap[key],
      icon: navIconMap[key],
      disabled: !currentUser && key !== "overview",
    })),
  }));
  const reportStatusCards = currentWeek
    ? [
      {
        key: "creative",
        title: "周三策划",
        state: renderApprovalText(currentWeek.creative.approval),
        summary: hasText(currentWeek.creative.marketing, currentWeek.creative.recipe, currentWeek.creative.procurement) || hasImages(currentWeek.creative.posters)
          ? "已录入策划内容"
          : "待录入策划内容",
      },
      {
        key: "daily",
        title: "每日执行",
        state: dailyManagerReviewStatus,
        summary: Object.keys(currentWeek.daily || {}).length
          ? `已记录 ${Object.keys(currentWeek.daily).length} 天`
          : "尚未录入每日执行",
      },
      {
        key: "handover",
        title: "交接班",
        state: renderApprovalText(currentWeek.handover.approval),
        summary: hasText(currentWeek.handover.summary, currentWeek.handover.nextGroup || currentWeek.nextGroup) || hasImages(currentWeek.handover.photos)
          ? "已记录交接内容"
          : "待补充交接记录",
      },
      {
        key: "reflection",
        title: "总结反思",
        state: renderApprovalText(currentWeek.reflection.approval),
        summary: hasText(currentWeek.reflection.a, currentWeek.reflection.b, currentWeek.reflection.optPlan, currentWeek.reflection.managerComment)
          ? "已沉淀复盘与评语"
          : "待补充总结与评语",
      },
    ]
    : [];
  const activeNavGroup = NAV_SECTIONS.find((section) => section.items.includes(activePage));
  const pageMeta = {
    overview: {
      eyebrow: activeNavGroup?.title || "开始使用",
      title: currentUser ? "系统概览" : "登录与概览",
      description: currentUser
        ? "查看本周状态。"
        : "请先登录。",
    },
    creative: {
      eyebrow: "本周轮值",
      title: "周三策划提交",
      description: "提交本周策划。",
    },
    daily: {
      eyebrow: "本周轮值",
      title: "每日打卡与运营",
      description: "记录每日执行。",
    },
    handover: {
      eyebrow: "本周轮值",
      title: "交接班（次周三）",
      description: "填写交接记录。",
    },
    reflection: {
      eyebrow: "本周轮值",
      title: "总结与反思",
      description: "完成周总结。",
    },
    reports: {
      eyebrow: "管理与归档",
      title: "周报导出",
      description: "预览或导出周报。",
    },
    accounts: {
      eyebrow: "管理与归档",
      title: "账号管理",
      description: "维护账号信息。",
    },
  };
  const currentPageMeta = pageMeta[activePage] || pageMeta.overview;
  const requiresWeek = currentUser && ["creative", "daily", "handover", "reflection"].includes(activePage);

  const renderOverviewPage = () => {
    if (!currentUser) {
      return (
        <div className="content-stack max-w-3xl">
          <LoginPanel
            loginForm={app.loginForm}
            loginMessage={app.loginMessage}
            loading={app.loading}
            onChange={handleLoginFormChange}
            onSubmit={handleLogin}
          />
        </div>
      );
    }

    return (
      <div className="content-grid">
        <div className="content-stack">
          <section className="soft-card">
            <h2 className="section-title">本周工作概览</h2>
            <div className="stats-grid">
              <article className="metric-card">
                <span>当前身份</span>
                <strong>{currentUser.displayName} · {levelLabel(currentUser.level)}</strong>
              </article>
              <article className="metric-card">
                <span>当前查看</span>
                <strong>{scopeUserRecord ? `${scopeUserRecord.displayName}（${scopeUserRecord.username}）` : "待选择学员"}</strong>
              </article>
              <article className="metric-card">
                <span>教学周次</span>
                <strong>{currentWeekGroup?.teachingWeek || "未设置"}</strong>
              </article>
              <article className="metric-card">
                <span>轮值周期</span>
                <strong>{currentWeek ? `${currentWeek.startDate} 至 ${currentWeek.endDate}` : "尚未加载本周"}</strong>
              </article>
            </div>
          </section>

          <section className="soft-card">
            <div className="section-row">
              <div>
                <h3 className="panel-title">本周状态</h3>
              </div>
            </div>
            <div className="status-grid">
              {reportStatusCards.length ? reportStatusCards.map((card) => (
                <article key={card.key} className="status-card">
                  <div className="status-card-head">
                    <span>{card.title}</span>
                    <button type="button" className="mini-link" onClick={() => handleTabChange(card.key)}>
                      进入
                    </button>
                  </div>
                  <strong>{card.summary}</strong>
                  <p>{card.state}</p>
                </article>
              )) : (
                <article className="status-card">
                  <div className="status-card-head">
                    <span>尚未加载本周</span>
                  </div>
                  <strong>先从左侧选择起始日并加载本周</strong>
                </article>
              )}
            </div>
          </section>
        </div>

        <aside className="content-stack">
          <section className="guide-card">
            <div className="guide-card-head">
              <FontAwesomeIcon icon={faUsers} />
              <h3>当前会话</h3>
            </div>
            <p>{sessionInfo}</p>
          </section>

          <section className="guide-card">
            <div className="guide-card-head">
              <FontAwesomeIcon icon={faDownload} />
              <h3>报告导出</h3>
            </div>
            <div className="guide-actions">
              <button className="btn-secondary" type="button" onClick={handlePreviewReport} disabled={!currentWeek}>
                预览/打印周报
              </button>
              <button className="btn-primary" type="button" onClick={handleExportWord} disabled={!currentWeek}>
                导出周报 Word
              </button>
            </div>
          </section>
        </aside>
      </div>
    );
  };

  const renderReportsPage = () => (
    <div className="content-grid">
      <div className="content-stack">
        <section className="soft-card">
          <h2 className="section-title">周报预览与导出</h2>
          <div className="guide-actions mt-4">
            <button className="btn-secondary" type="button" onClick={handlePreviewReport} disabled={!currentWeek}>
              预览/打印周报
            </button>
            <button className="btn-primary" type="button" onClick={handleExportWord} disabled={!currentWeek}>
              导出周报 Word
            </button>
          </div>
        </section>

        {currentWeek ? (
          <section className="soft-card">
            <h3 className="panel-title">归档状态</h3>
            <div className="status-grid">
              {reportStatusCards.map((card) => (
                <article key={card.key} className="status-card">
                  <div className="status-card-head">
                    <span>{card.title}</span>
                    <button type="button" className="mini-link" onClick={() => handleTabChange(card.key)}>
                      查看页面
                    </button>
                  </div>
                  <strong>{card.summary}</strong>
                  <p>{card.state}</p>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="soft-card">
            <h3 className="panel-title">尚未生成报告源数据</h3>
            <p className="status-line mt-4">先加载本周并填写模块内容。</p>
          </section>
        )}
      </div>
    </div>
  );

  if (app.booting) {
    return (
      <div className="site-shell loading-shell">
        <div className="loading-card">
          <h1 className="section-title">系统初始化中...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="site-shell docs-shell">
      <Sidebar
        currentUser={currentUser}
        roleLabel={currentUser ? levelLabel(currentUser.level) : ""}
        sessionInfo={sessionInfo}
        navSections={navSections}
        activePage={activePage}
        onNavigate={handleTabChange}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
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

      <div className="site-main">
        <header className="topbar no-print">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button lg:hidden"
              aria-label="打开导航"
              onClick={() => setMobileNavOpen(true)}
            >
              <FontAwesomeIcon icon={faBars} />
            </button>

            <label className="topbar-search">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="topbar-search-icon" />
              <input
                type="text"
                placeholder="搜索页面、模块或动作"
                aria-label="搜索页面、模块或动作"
                readOnly
                onFocus={(event) => event.target.blur()}
              />
            </label>
          </div>

          <div className="topbar-right">
            <span className="utility-pill">
              <FontAwesomeIcon icon={currentUser ? faMugHot : faBookOpen} />
              {currentUser ? `${currentUser.displayName} · ${levelLabel(currentUser.level)}` : "访客模式"}
            </span>
            {currentUser ? (
              <button className="icon-button" type="button" onClick={handleLogout} aria-label="顶部退出">
                <FontAwesomeIcon icon={faRightFromBracket} />
              </button>
            ) : null}
          </div>
        </header>

        {currentUser ? (
          <div className="mobile-tabbar no-print">
            <TabNav items={TAB_ITEMS} activeTab={activePage} onChange={handleTabChange} />
          </div>
        ) : null}

        <main className="content-shell">
          <section className="page-header">
            <div className="page-header-copy">
              <p className="workspace-kicker">{currentPageMeta.eyebrow}</p>
              <h1 className="workspace-heading">{currentPageMeta.title}</h1>
              {currentPageMeta.description ? <p className="panel-lead">{currentPageMeta.description}</p> : null}
            </div>

            <div className="page-actions no-print">
              {currentUser ? (
                <>
                  <button className="btn-secondary" type="button" onClick={handleLoadWeek}>
                    快速加载本周
                  </button>
                  <button className="btn-secondary" type="button" onClick={handlePreviewReport} disabled={!currentWeek}>
                    快速预览周报
                  </button>
                  <button className="btn-primary" type="button" onClick={handleExportWord} disabled={!currentWeek}>
                    快速导出周报
                  </button>
                </>
              ) : null}
            </div>
          </section>

          {requiresWeek && !currentWeek ? (
            <section className="soft-card">
              <h2 className="section-title">请先加载本周</h2>
              <p className="status-line mt-4">左侧选择起始日后，点击“加载/创建本周”。</p>
            </section>
          ) : null}

          {activePage === "overview" ? renderOverviewPage() : null}

          {activePage === "creative" && currentWeek ? (
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

          {activePage === "daily" && currentWeek && currentDayData ? (
            <DailyTab
              dailyDateOptions={dailyDateOptions}
              currentDay={app.currentDay}
              data={currentDayData}
              rawEditable={dailyRole.canEditRawFields}
              canUploadImages={dailyRole.canUploadImages}
              canEditManagerReview={dailyRole.canEditManagerReview}
              canSaveDaily={currentUser?.level === "P3"}
              managerReviewStatus={dailyManagerReviewStatus}
              managerSubmitDisabled={dailyManagerReviewDisabled}
              onDateChange={handleDailyDateChange}
              onFieldChange={handleDailyFieldChange}
              onManagerReviewFieldChange={handleManagerReviewFieldChange}
              onAddImages={addDailyImages}
              onSave={saveDaily}
              onSubmitManagerReview={submitDailyReview}
            />
          ) : null}

          {activePage === "handover" && currentWeek ? (
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

          {activePage === "reflection" && currentWeek ? (
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

          {activePage === "reports" ? renderReportsPage() : null}

          {activePage === "accounts" ? (
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
        </main>
      </div>
    </div>
  );
}

export default App;
