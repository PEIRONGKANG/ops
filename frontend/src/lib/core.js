import { TEACHING_WEEK_MAP, TEACHING_WEEK_PRESETS } from "./constants.js";

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

export const PROCESS_ITEM_DEFINITIONS = [
  {
    key: "13",
    title: "门店运营开档工作要求",
    shortTitle: "开档",
    guidance: "开档前确认设备、原料、收银和公区准备完成，保留现场图片。",
    requiresImages: true,
  },
  {
    key: "14",
    title: "门店运营饮品制作工作要求",
    shortTitle: "饮品制作",
    guidance: "记录当日核心出品、制作标准、异常调整与出品节奏。",
    requiresImages: false,
  },
  {
    key: "15",
    title: "门店运营服务工作要求",
    shortTitle: "服务",
    guidance: "记录顾客接待、服务话术、客诉处理与服务细节。",
    requiresImages: false,
  },
  {
    key: "16",
    title: "门店运营清洁工作要求",
    shortTitle: "清洁",
    guidance: "记录吧台、公区、器具清洁与卫生标准执行情况。",
    requiresImages: true,
  },
  {
    key: "17",
    title: "门店运营食品安全工作要求",
    shortTitle: "食品安全",
    guidance: "记录原料保质、温控、标签、封存与异常处理情况。",
    requiresImages: false,
  },
  {
    key: "18",
    title: "门店运营收档工作要求",
    shortTitle: "收档",
    guidance: "记录收档清点、设备断电、收尾清洁与现场交接。",
    requiresImages: true,
  },
  {
    key: "19",
    title: "门店运营库存盘点工作要求",
    shortTitle: "库存盘点",
    guidance: "记录关键原料库存、缺货预警、损耗与补货建议。",
    requiresImages: true,
  },
  {
    key: "20",
    title: "门店运营报表统计工作要求",
    shortTitle: "报表统计",
    guidance: "记录营业额、成本、杯量、客流等经营统计结果。",
    requiresImages: false,
  },
  {
    key: "21",
    title: "门店运营成本控制工作要求",
    shortTitle: "成本控制",
    guidance: "记录损耗原因、控制动作、成本复盘与改进建议。",
    requiresImages: false,
  },
  {
    key: "22",
    title: "门店运营营业推广工作要求",
    shortTitle: "营业推广",
    guidance: "记录当日推广动作、物料布置、话术执行与转化反馈。",
    requiresImages: true,
  },
];

export function getProcessDefinition(key) {
  return PROCESS_ITEM_DEFINITIONS.find((item) => item.key === String(key)) || null;
}

function normalizeImageList(images, limit = Infinity) {
  return Array.from(images || []).filter(Boolean).slice(0, limit);
}

export function addImagesWithLimit(existing, nextImages, limit = 5) {
  return normalizeImageList([...(existing || []), ...(nextImages || [])], limit);
}

function createEmptySurvey() {
  return {
    questions: "",
    sampleSize: "",
    resultSummary: "",
    resultImages: [],
    analysis: "",
  };
}

function createEmptyDrink(index) {
  return {
    id: `drink-${index + 1}`,
    name: "",
    type: "",
    inspiration: "",
    ingredients: "",
    ratio: "",
    steps: "",
    productImages: [],
    posterImages: [],
    specialMaterials: "",
    notes: "",
  };
}

export function createEmptyProcurementItem() {
  return {
    name: "",
    spec: "",
    quantity: "",
    unitPrice: "",
    subtotal: "",
    notes: "",
  };
}

function createEmptyProcessItem(key) {
  const definition = getProcessDefinition(key);
  return {
    key: String(key),
    title: definition?.title || "",
    shortTitle: definition?.shortTitle || "",
    guidance: definition?.guidance || "",
    requiresImages: Boolean(definition?.requiresImages),
    execution: "",
    images: [],
    approval: emptyApproval(),
  };
}

function createEmptyDailyReport() {
  return {
    summary: "",
    highlights: "",
    issues: "",
    followUp: "",
  };
}

export function createEmptyCreative() {
  return {
    marketing: "",
    recipe: "",
    procurement: "",
    survey: createEmptySurvey(),
    drinks: [createEmptyDrink(0), createEmptyDrink(1)],
    procurementItems: [createEmptyProcurementItem()],
    posters: [],
    approval: emptyApproval(),
  };
}

export function createEmptyWeek(startDate) {
  const dates = getWeekDates(startDate);
  return {
    startDate,
    endDate: dates[7],
    teachingWeek: "",
    members: { a: "", b: "" },
    nextGroup: "",
    creative: createEmptyCreative(),
    daily: {},
    handover: {
      summary: "",
      nextGroup: "",
      photos: [],
      inheritedDrinks: [],
      inheritedFrom: {
        batchName: "",
        groupName: "",
        weekStartDate: "",
        studentName: "",
      },
      confirmation: {
        status: "待确认",
        by: "",
        time: "",
      },
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

export function ensureWeekStructure(week, fallbackStartDate = todayISO()) {
  const base = week || createEmptyWeek(fallbackStartDate);
  const normalized = {
    ...createEmptyWeek(trim(base.startDate) || fallbackStartDate),
    ...base,
  };

  normalized.creative = {
    ...createEmptyCreative(),
    ...(base.creative || {}),
    survey: {
      ...createEmptySurvey(),
      ...(base.creative?.survey || {}),
      resultImages: normalizeImageList(base.creative?.survey?.resultImages, 5),
    },
    drinks: Array.from({ length: 2 }).map((_, index) => ({
      ...createEmptyDrink(index),
      ...(base.creative?.drinks?.[index] || {}),
      productImages: normalizeImageList(base.creative?.drinks?.[index]?.productImages, 5),
      posterImages: normalizeImageList(base.creative?.drinks?.[index]?.posterImages, 5),
    })),
    procurementItems: (base.creative?.procurementItems?.length
      ? base.creative.procurementItems
      : [createEmptyProcurementItem()]
    ).map((item) => ({
      ...createEmptyProcurementItem(),
      ...item,
    })),
    posters: normalizeImageList(base.creative?.posters, 8),
    approval: base.creative?.approval || emptyApproval(),
  };

  if (!trim(normalized.creative.survey.analysis) && trim(base.creative?.marketing)) {
    normalized.creative.survey.analysis = trim(base.creative.marketing);
  }
  if (!trim(normalized.creative.drinks[0].steps) && trim(base.creative?.recipe)) {
    normalized.creative.drinks[0].steps = trim(base.creative.recipe);
  }
  if (!trim(normalized.creative.procurementItems[0].notes) && trim(base.creative?.procurement)) {
    normalized.creative.procurementItems[0].notes = trim(base.creative.procurement);
  }

  normalized.handover = {
    summary: "",
    nextGroup: "",
    photos: [],
    inheritedDrinks: [],
    inheritedFrom: {
      batchName: "",
      groupName: "",
      weekStartDate: "",
      studentName: "",
    },
    confirmation: {
      status: "待确认",
      by: "",
      time: "",
    },
    ...(base.handover || {}),
  };
  normalized.handover.photos = normalizeImageList(base.handover?.photos, 5);
  normalized.handover.inheritedDrinks = Array.isArray(base.handover?.inheritedDrinks)
    ? base.handover.inheritedDrinks.slice(0, 2).map((item, index) => ({
      ...createEmptyDrink(index),
      ...item,
      productImages: normalizeImageList(item?.productImages, 5),
      posterImages: normalizeImageList(item?.posterImages, 5),
    }))
    : [];
  normalized.handover.approval = base.handover?.approval || emptyApproval();

  normalized.reflection = {
    a: "",
    b: "",
    optPlan: "",
    managerComment: "",
    ...(base.reflection || {}),
  };
  normalized.reflection.approval = base.reflection?.approval || emptyApproval();

  if (!normalized.daily || typeof normalized.daily !== "object") {
    normalized.daily = {};
  }
  Object.keys(normalized.daily).forEach((date) => {
    normalized.daily[date] = ensureDayOnWeek(normalized, date);
  });

  return normalized;
}

export function ensureDayOnWeek(week, day) {
  if (!week.daily[day]) {
    week.daily[day] = {
      checkIn: "",
      checkOut: "",
      attendanceNote: "",
      attendanceStatus: "待审核",
      exceptionNote: "",
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
      processes: {},
      dailyReport: createEmptyDailyReport(),
      approvals: {
        checkIn: emptyApproval(),
        checkOut: emptyApproval(),
        grooming: emptyApproval(),
        receipt: emptyApproval(),
      },
    };
  }

  const record = week.daily[day];
  const approvals = record.approvals || {};
  if (!approvals.checkIn && approvals.attendance) approvals.checkIn = { ...approvals.attendance };
  if (!approvals.checkOut && approvals.attendance) approvals.checkOut = { ...approvals.attendance };

  record.approvals = {
    checkIn: approvals.checkIn || emptyApproval(),
    checkOut: approvals.checkOut || emptyApproval(),
    grooming: approvals.grooming || emptyApproval(),
    receipt: approvals.receipt || emptyApproval(),
  };

  if (!record.dailyReport) {
    record.dailyReport = createEmptyDailyReport();
  } else {
    record.dailyReport = {
      summary: trim(record.dailyReport.summary),
      highlights: trim(record.dailyReport.highlights),
      issues: trim(record.dailyReport.issues),
      followUp: trim(record.dailyReport.followUp),
    };
  }

  if (!record.processes || typeof record.processes !== "object") {
    record.processes = {};
  }

  PROCESS_ITEM_DEFINITIONS.forEach((definition) => {
    const current = record.processes[definition.key] || createEmptyProcessItem(definition.key);
    record.processes[definition.key] = {
      ...createEmptyProcessItem(definition.key),
      ...current,
      images: normalizeImageList(current.images, 5),
      approval: current.approval || emptyApproval(),
    };
  });

  if (!record.processes["13"].images.length && (record.openingPublic?.length || record.openingBar?.length)) {
    record.processes["13"].images = normalizeImageList([...(record.openingPublic || []), ...(record.openingBar || [])], 5);
  }
  if (!record.processes["18"].images.length && (record.closingPublic?.length || record.closingBar?.length)) {
    record.processes["18"].images = normalizeImageList([...(record.closingPublic || []), ...(record.closingBar || [])], 5);
  }
  if (!trim(record.processes["19"].execution) && trim(record.inventoryDesc)) {
    record.processes["19"].execution = trim(record.inventoryDesc);
  }
  if (!record.processes["19"].images.length && record.inventoryImgs?.length) {
    record.processes["19"].images = normalizeImageList(record.inventoryImgs, 5);
  }
  if (!trim(record.processes["20"].execution) && (trim(record.sales) || trim(record.cost) || trim(record.lossAmount))) {
    record.processes["20"].execution = `营业额 ${trim(record.sales) || "0"} 元；成本 ${trim(record.cost) || "0"} 元；损耗 ${trim(record.lossAmount) || "0"} 元。`;
  }
  if (!trim(record.processes["21"].execution) && (trim(record.lossDesc) || trim(record.cost) || trim(record.lossAmount))) {
    record.processes["21"].execution = `损耗说明：${trim(record.lossDesc) || "未填写"}；成本 ${trim(record.cost) || "0"} 元；损耗 ${trim(record.lossAmount) || "0"} 元。`;
  }
  if (!trim(record.dailyReport.issues) && trim(record.notes)) {
    record.dailyReport.issues = trim(record.notes);
  }

  record.grooming = normalizeImageList(record.grooming, 5);
  record.lossImgs = normalizeImageList(record.lossImgs, 5);
  record.inventoryImgs = normalizeImageList(record.inventoryImgs, 5);
  record.receiptImgs = normalizeImageList(record.receiptImgs, 5);
  record.openingPublic = normalizeImageList(record.openingPublic, 5);
  record.openingBar = normalizeImageList(record.openingBar, 5);
  record.closingPublic = normalizeImageList(record.closingPublic, 5);
  record.closingBar = normalizeImageList(record.closingBar, 5);

  return record;
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
