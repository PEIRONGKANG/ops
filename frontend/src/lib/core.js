import { TEACHING_WEEK_MAP, TEACHING_WEEK_PRESETS } from "./constants";

export const trim = (value) => String(value ?? "").trim();

export function levelFromRole(role) {
  if (role === "admin") return "P1";
  if (role === "manager") return "P2";
  return "P3";
}

export function roleFromLevel(level) {
  if (level === "P1") return "admin";
  if (level === "P2") return "manager";
  return "student";
}

export function normalizeUser(userLike = {}) {
  const username = trim(userLike.username);
  const password = trim(userLike.password);
  const level = userLike.level || levelFromRole(userLike.role);
  const role = roleFromLevel(level);
  return {
    username,
    password,
    role,
    level,
    displayName: trim(userLike.displayName) || username,
    ownerType: trim(userLike.ownerType || ""),
    passwordUpdatedAt: userLike.passwordUpdatedAt || "",
    nameUpdatedAt: userLike.nameUpdatedAt || "",
  };
}

export function formatDateTime(value) {
  const raw = trim(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("zh-CN");
}

export function normalizeTeacherNotice(noticeLike = {}) {
  const receipts = Array.isArray(noticeLike.receipts) ? noticeLike.receipts : [];
  return {
    id: trim(noticeLike.id),
    title: trim(noticeLike.title),
    message: trim(noticeLike.message),
    images: Array.isArray(noticeLike.images) ? noticeLike.images.filter(Boolean) : [],
    authorUsername: trim(noticeLike.authorUsername),
    authorDisplayName: trim(noticeLike.authorDisplayName) || trim(noticeLike.authorUsername),
    createdAt: formatDateTime(noticeLike.createdAt),
    updatedAt: formatDateTime(noticeLike.updatedAt),
    receipts: receipts
      .map((receipt) => ({
        username: trim(receipt?.username),
        displayName: trim(receipt?.displayName) || trim(receipt?.username),
        level: trim(receipt?.level),
        receivedAt: formatDateTime(receipt?.receivedAt),
      }))
      .filter((receipt) => receipt.username),
  };
}

export function levelLabel(level) {
  if (level === "P1") return "P1 最高权限";
  if (level === "P2") return "P2 运营经理";
  return "P3 学生";
}

export function todayISO() {
  return fmt(new Date());
}

export function toDate(value) {
  const [y, m, day] = String(value).split("-").map((item) => Number(item));
  return new Date(y, (m || 1) - 1, day || 1);
}

export function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function adjustToWednesday(isoDate) {
  const date = toDate(isoDate);
  const diff = (date.getDay() - 3 + 7) % 7;
  date.setDate(date.getDate() - diff);
  return fmt(date);
}

export function getWeekDates(startIso) {
  const dates = [];
  const base = toDate(startIso);
  for (let index = 0; index < 8; index += 1) {
    const date = new Date(base);
    date.setDate(date.getDate() + index);
    dates.push(fmt(date));
  }
  return dates;
}

export function makeWeekKey(startDate, scopeUser) {
  return `${trim(scopeUser)}::${trim(startDate)}`;
}

export function emptyApproval() {
  return { by: "", time: "", comment: "" };
}

export function createEmptyWeek(startDate) {
  const dates = getWeekDates(startDate);
  return {
    startDate,
    endDate: dates[7],
    teachingWeek: "",
    members: { a: "", b: "" },
    nextGroup: "",
    creative: {
      marketing: "",
      recipe: "",
      procurement: "",
      posters: [],
      approval: emptyApproval(),
    },
    daily: {},
    handover: {
      summary: "",
      nextGroup: "",
      photos: [],
      approval: emptyApproval(),
    },
    reflection: {
      a: "",
      b: "",
      optPlan: "",
      managerComment: "",
      approval: emptyApproval(),
    },
  };
}

export function ensureDayOnWeek(week, day) {
  if (!week.daily[day]) {
    week.daily[day] = {
      checkIn: "",
      checkOut: "",
      attendanceNote: "",
      leaveImgs: [],
      notes: "",
      grooming: [],
      openingPublic: [],
      openingBar: [],
      closingPublic: [],
      closingBar: [],
      sales: "",
      cost: "",
      lossAmount: "",
      lossDesc: "",
      lossImgs: [],
      inventoryDesc: "",
      inventoryImgs: [],
      receiptDesc: "",
      receiptImgs: [],
      managerNotes: {
        checkIn: "",
        checkOut: "",
        grooming: "",
        opening: "",
        closing: "",
        finance: "",
        receipt: "",
        notes: "",
      },
      approvals: {
        checkIn: emptyApproval(),
        checkOut: emptyApproval(),
        grooming: emptyApproval(),
        opening: emptyApproval(),
        finance: emptyApproval(),
        receipt: emptyApproval(),
        closing: emptyApproval(),
        notes: emptyApproval(),
      },
      studentConfirmations: {
        checkIn: emptyApproval(),
        checkOut: emptyApproval(),
        grooming: emptyApproval(),
        opening: emptyApproval(),
        finance: emptyApproval(),
        receipt: emptyApproval(),
        closing: emptyApproval(),
        notes: emptyApproval(),
      },
    };
  }

  const managerNotes = week.daily[day].managerNotes || {};
  const approvals = week.daily[day].approvals || {};
  const studentConfirmations = week.daily[day].studentConfirmations || {};
  if (!approvals.checkIn && approvals.attendance) approvals.checkIn = { ...approvals.attendance };
  if (!approvals.checkOut && approvals.attendance) approvals.checkOut = { ...approvals.attendance };
  week.daily[day].leaveImgs = Array.isArray(week.daily[day].leaveImgs) ? week.daily[day].leaveImgs : [];

  week.daily[day].managerNotes = {
    checkIn: managerNotes.checkIn || "",
    checkOut: managerNotes.checkOut || "",
    grooming: managerNotes.grooming || "",
    opening: managerNotes.opening || "",
    closing: managerNotes.closing || "",
    finance: managerNotes.finance || "",
    receipt: managerNotes.receipt || "",
    notes: managerNotes.notes || "",
  };

  week.daily[day].approvals = {
    checkIn: approvals.checkIn || emptyApproval(),
    checkOut: approvals.checkOut || emptyApproval(),
    grooming: approvals.grooming || emptyApproval(),
    opening: approvals.opening || emptyApproval(),
    finance: approvals.finance || emptyApproval(),
    receipt: approvals.receipt || emptyApproval(),
    closing: approvals.closing || emptyApproval(),
    notes: approvals.notes || emptyApproval(),
  };

  week.daily[day].studentConfirmations = {
    checkIn: studentConfirmations.checkIn || emptyApproval(),
    checkOut: studentConfirmations.checkOut || emptyApproval(),
    grooming: studentConfirmations.grooming || emptyApproval(),
    opening: studentConfirmations.opening || emptyApproval(),
    finance: studentConfirmations.finance || emptyApproval(),
    receipt: studentConfirmations.receipt || emptyApproval(),
    closing: studentConfirmations.closing || emptyApproval(),
    notes: studentConfirmations.notes || emptyApproval(),
  };

  return week.daily[day];
}

export function getTeachingWeekPreset(value) {
  return TEACHING_WEEK_MAP[trim(value)] || null;
}

export function createEmptyWeekGroup() {
  return { a: "", b: "", nextGroup: "", teachingWeek: "" };
}

export function applyTeachingWeekPreset(group, teachingWeek, keepMembersWhenBlank = true) {
  const value = trim(teachingWeek);
  const preset = getTeachingWeekPreset(value);
  group.teachingWeek = value;

  if (!preset) {
    if (!keepMembersWhenBlank) {
      group.a = "";
      group.b = "";
    }
    return false;
  }

  if (preset.a || preset.b || preset.note) {
    group.a = preset.a || "";
    group.b = preset.b || "";
  } else if (!keepMembersWhenBlank) {
    group.a = "";
    group.b = "";
  }
  return true;
}

export function describeTeachingWeek(group) {
  const preset = getTeachingWeekPreset(group?.teachingWeek);
  const members = [trim(group?.a), trim(group?.b)].filter(Boolean);
  if (preset?.note) return `${preset.label}安排：${preset.note}`;
  if (preset && members.length) return `${preset.label}名单：${members.join("、")}`;
  if (members.length) return `当前分组：${members.join("、")}`;
  return "未套用分组名单，可手动填写。";
}

export function syncWeekGroupForWeek(week, group) {
  const shared = group || createEmptyWeekGroup();
  if (!shared.teachingWeek) shared.teachingWeek = "";

  const preset = getTeachingWeekPreset(shared.teachingWeek);
  if (preset && !trim(shared.a) && !trim(shared.b) && (preset.a || preset.b || preset.note)) {
    shared.a = preset.a || "";
    shared.b = preset.b || "";
  }

  const sharedEmpty = !trim(shared.a) && !trim(shared.b) && !trim(shared.nextGroup);
  if (sharedEmpty && !(preset && (preset.a || preset.b || preset.note))) {
    shared.a = trim(week.members?.a);
    shared.b = trim(week.members?.b);
    shared.nextGroup = trim(week.nextGroup);
    week.teachingWeek = trim(shared.teachingWeek);
    return false;
  }

  week.members.a = trim(shared.a);
  week.members.b = trim(shared.b);
  week.nextGroup = trim(shared.nextGroup);
  week.teachingWeek = trim(shared.teachingWeek);
  if (!trim(week.handover.nextGroup) && trim(shared.nextGroup)) {
    week.handover.nextGroup = trim(shared.nextGroup);
  }
  return true;
}

export function renderApprovalText(approval) {
  if (!approval || !approval.by) return "待运营经理确认";
  return `已确认：${approval.by}（${approval.time || "-"}）`;
}

export async function filesToDataUrls(fileList) {
  const files = Array.from(fileList || []);
  const tasks = files.map(
    (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result || "");
        reader.readAsDataURL(file);
      }),
  );
  return Promise.all(tasks);
}

export function getStudentUsers(users) {
  return users
    .filter((user) => user.level === "P3")
    .sort((a, b) => a.username.localeCompare(b.username));
}

export function findStudentByToken(users, token) {
  const value = trim(token);
  if (!value) return null;
  return (
    users.find(
      (user) => user.level === "P3" && (user.username === value || user.displayName === value),
    ) || null
  );
}

export function buildTeachingWeekOptions() {
  return TEACHING_WEEK_PRESETS.map((item) => ({
    ...item,
    text: `${item.label}${item.note ? ` ${item.note}` : ""}`,
  }));
}
