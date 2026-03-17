import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright-core";

const baseUrl = process.env.APP_URL || "http://111.229.16.93:8000";
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const workspaceRoot = path.resolve(process.cwd(), "..");
const artifactDir = path.join(workspaceRoot, "output", "playwright");
const downloadDir = path.join(artifactDir, "downloads");
const uploadFixture = path.join(workspaceRoot, "_hygiene_preview.png");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const runLabel = `REG-${timestamp}`;
const apiBase = new URL("/api/", baseUrl).toString();

const tempTag = timestamp.replace(/\D/g, "").slice(-8);
const studentA = {
  username: `97${tempTag}`,
  password: `97${tempTag}`,
  displayName: `回归学员A-${tempTag.slice(-4)}`,
};
const studentB = {
  username: `98${tempTag}`,
  password: `98${tempTag}`,
  displayName: `回归学员B-${tempTag.slice(-4)}`,
};
const managerAccount = {
  username: `96${tempTag}`,
  password: `96${tempTag}`,
  updatedPassword: `86${tempTag}7`,
  displayName: `回归经理-${tempTag.slice(-4)}`,
};
const noticeTitle = `公网回归留言 ${runLabel}`;
const noticeMessage = `用于校验登录前后共享图文提醒、信息收到和发布删除链路。${runLabel}`;
const weekStart = buildFutureWednesday();

let createdNoticeId = "";
let accountsCreated = false;
let p1Account = null;
let reviewerAccount = null;

await mkdir(downloadDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

const context = await browser.newContext({
  acceptDownloads: true,
  locale: "zh-CN",
});
const page = await context.newPage();

function buildFutureWednesday() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 3650);
  while (date.getUTCDay() !== 3) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function waitForWeekLoaded(expectedStart = weekStart) {
  const expectedEnd = addDays(expectedStart, 7);
  const sidebar = page.locator(".sidebar-shell");
  const endInput = sidebar.locator("input").nth(1);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if ((await endInput.inputValue().catch(() => "")) === expectedEnd) return;
    await page.waitForTimeout(500);
  }
  assert.fail(`周次 ${expectedStart} 未加载完成。`);
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(new URL(endpoint.replace(/^\//, ""), apiBase), {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`API ${response.status} ${endpoint}: ${detail}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function listAccounts() {
  const data = await apiRequest("/accounts");
  return data.users || [];
}

async function getAvailableP1Account() {
  const accounts = await listAccounts();
  const match = accounts.find((item) => item.level === "P1" && item.username && item.password);
  assert(match, "接口未返回可用的 P1 账号。");
  return {
    username: match.username,
    password: match.password,
  };
}

async function getAvailableReviewerAccount() {
  const accounts = await listAccounts();
  const p2 = accounts.find((item) => item.level === "P2" && item.username && item.password);
  if (p2) {
    return {
      username: p2.username,
      password: p2.password,
      level: p2.level,
    };
  }
  const p1 = accounts.find((item) => item.level === "P1" && item.username && item.password);
  assert(p1, "接口未返回可用的审核账号。");
  return {
    username: p1.username,
    password: p1.password,
    level: p1.level,
  };
}

async function listNotices() {
  const data = await apiRequest("/teacher-notices");
  return data.notices || [];
}

async function fetchWeek(scopeUser) {
  const data = await apiRequest(`/weeks/${encodeURIComponent(scopeUser)}/${encodeURIComponent(weekStart)}`);
  return data.week;
}

async function waitForWeekCondition(scopeUser, predicate, message) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const week = await fetchWeek(scopeUser);
    if (week && predicate(week)) {
      return week;
    }
    await page.waitForTimeout(300);
  }
  assert.fail(message);
}

async function screenshot(name) {
  const target = path.join(artifactDir, `${name}-${timestamp}.png`);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

async function expectVisible(locator, message) {
  await locator.waitFor({ state: "visible", timeout: 20000 });
  assert(await locator.isVisible(), message);
}

async function expectTextVisible(text, message) {
  await expectVisible(page.getByText(text, { exact: false }).first(), message);
}

async function typeAndBlur(locator, value) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await locator.evaluate((node, nextValue) => {
        const prototype = node instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
        descriptor?.set?.call(node, nextValue);
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
        node.blur();
      }, value);
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await page.waitForTimeout(300);
    }
  }
}

async function waitForInputValue(locator, expectedValue) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if ((await locator.inputValue().catch(() => "")) === expectedValue) return;
    await page.waitForTimeout(200);
  }
  assert.fail(`输入框值未更新为预期内容：${expectedValue}`);
}

async function enterPortalIfNeeded() {
  const enterButton = page.locator(".portal-enter-button");
  if (await enterButton.count()) {
    if (await enterButton.first().isVisible()) {
      await enterButton.first().click();
    }
  }
}

async function openFreshPublicHome() {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function loginAs({ username, password, secondUsername = "", secondPassword = "" }) {
  const panel = page.locator(".login-card");
  await expectVisible(panel, "未显示登录面板。");
  const inputs = panel.locator("input");
  await typeAndBlur(inputs.nth(0), username);
  await typeAndBlur(inputs.nth(1), password);

  if (secondUsername || secondPassword) {
    await typeAndBlur(inputs.nth(2), secondUsername);
    await typeAndBlur(inputs.nth(3), secondPassword);
  }

  await panel.getByRole("button", { name: "登录系统" }).click();
}

async function logout() {
  await page.getByRole("button", { name: "退出登录" }).click();
  await expectVisible(page.locator(".login-card"), "退出后未回到公开登录页。");
}

async function openSidebarTab(index) {
  const config = [
    { label: "创意策划", heading: "创意饮品策划提交（周三）" },
    { label: "日常运营", heading: "每日打卡与运营执行" },
    { label: "班次交接", heading: "次周周三交接班" },
    { label: "总结复盘", heading: "总结与反思（周结束）" },
    { label: "账号管理", heading: "账号管理" },
  ][index];
  assert(config, `Unknown tab index: ${index}`);
  const workbench = page.locator(".ops-workbench");
  const button = workbench.locator(".ops-inline-tabs").getByRole("button", { name: config.label, exact: true }).first();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await button.click({ force: true });
    try {
      await expectVisible(workbench.locator(".ops-panel-head h3").filter({ hasText: config.label }).first(), `切换到“${config.label}”后未显示对应模块。`);
      await expectVisible(sectionByHeading(config.heading), `切换到“${config.label}”后未显示对应模块。`);
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await page.waitForTimeout(500);
    }
  }
}

function sectionByHeading(name) {
  return page.locator(".ops-workbench-body section").filter({ has: page.getByRole("heading", { name, exact: true }) }).first();
}

async function setHiddenFileInput(scope, index = 0) {
  await scope.locator('input[type="file"]').nth(index).setInputFiles(uploadFixture);
}

async function waitForPreviewCount(scope, expected) {
  const previews = scope.locator("img.media-preview-item");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await previews.count() >= expected) return;
    await page.waitForTimeout(200);
  }
  assert.fail(`预览图片数量未达到 ${expected}。`);
}

async function waitForButtonEnabled(locator, message) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await locator.isEnabled()) return;
    await page.waitForTimeout(500);
  }
  assert.fail(message);
}

async function waitForAccount(username, predicate = () => true) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const match = (await listAccounts()).find((item) => item.username === username);
    if (match && predicate(match)) {
      return match;
    }
    await page.waitForTimeout(300);
  }
  assert.fail(`账号 ${username} 未达到预期状态。`);
}

async function waitForNotice(title) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const match = (await listNotices()).find((item) => item.title === title);
    if (match) return match;
    await page.waitForTimeout(300);
  }
  assert.fail(`留言 ${title} 未出现在接口返回中。`);
}

async function createTeacherNotice() {
  const composer = page.locator(".ops-notice-composer");
  await expectVisible(composer, "P1 登录后未显示留言发布区。");
  const fields = composer.locator("input, textarea");
  await typeAndBlur(fields.nth(0), noticeTitle);
  await typeAndBlur(fields.nth(1), noticeMessage);
  await setHiddenFileInput(composer);
  await composer.getByRole("button", { name: "发布留言" }).click();
  const notice = await waitForNotice(noticeTitle);
  createdNoticeId = notice.id;
  assert.equal(notice.images.length, 1, "留言图片未成功保存。");
}

async function createRegressionAccountsViaUI() {
  await openSidebarTab(4);
  const accountsSection = sectionByHeading("账号管理");
  await expectVisible(accountsSection, "未打开账号管理模块。");

  const createCard = accountsSection.locator(".soft-card").nth(1);
  const createInputs = createCard.locator("input");
  const createLevel = createCard.locator("select");
  const createButton = createCard.getByRole("button", { name: "新增账号" });

  const createAccount = async ({ username, displayName, password, level }) => {
    await typeAndBlur(createInputs.nth(0), username);
    await waitForInputValue(createInputs.nth(0), username);
    await typeAndBlur(createInputs.nth(1), displayName);
    await waitForInputValue(createInputs.nth(1), displayName);
    await typeAndBlur(createInputs.nth(2), password);
    await waitForInputValue(createInputs.nth(2), password);
    await createLevel.selectOption(level);
    await waitForButtonEnabled(createButton, `新增账号按钮未变为可点击：${username}`);
    await createButton.click();
    await waitForAccount(username, (user) => user.displayName === displayName && user.level === level);
  };

  await createAccount({ ...studentA, level: "P3" });
  await createAccount({ ...studentB, level: "P3" });
  await createAccount({ username: managerAccount.username, displayName: managerAccount.displayName, password: managerAccount.password, level: "P2" });

  const editCard = accountsSection.locator(".soft-card").nth(2);
  await editCard.locator("select").selectOption(managerAccount.username);
  const editInputs = editCard.locator("input");
  await typeAndBlur(editInputs.nth(0), `${managerAccount.displayName}（已校验）`);
  await typeAndBlur(editInputs.nth(1), managerAccount.updatedPassword);
  await editCard.getByRole("button", { name: "保存账号修改" }).click();
  await waitForAccount(
    managerAccount.username,
    (user) => user.displayName === `${managerAccount.displayName}（已校验）` && user.password === managerAccount.updatedPassword,
  );

  reviewerAccount = {
    username: managerAccount.username,
    password: managerAccount.updatedPassword,
    level: "P2",
  };
  accountsCreated = true;
}

async function prepareWeekForStudents() {
  const sidebar = page.locator(".sidebar-shell");
  await sidebar.locator('input[type="date"]').fill(weekStart);
  await sidebar.getByRole("button", { name: "加载/创建本周" }).click();
  await waitForWeekLoaded();
  await sidebar.locator("select").nth(0).waitFor({ state: "visible", timeout: 20000 });
  await sidebar.locator("select").nth(0).selectOption("第17周");
  await typeAndBlur(sidebar.locator("input").nth(2), `${studentA.displayName} / ${studentA.username}`);
  await typeAndBlur(sidebar.locator("input").nth(3), `${studentB.displayName} / ${studentB.username}`);
  await typeAndBlur(sidebar.locator("input").nth(4), `下一组-${runLabel}`);
  await sidebar.getByRole("button", { name: "保存分组" }).click();
}

async function loadRegressionWeekForCurrentSession() {
  const sidebar = page.locator(".sidebar-shell");
  await sidebar.locator('input[type="date"]').fill(weekStart);
  await sidebar.getByRole("button", { name: "加载/创建本周" }).click();
  await waitForWeekLoaded();
}

async function completeCreativeTab() {
  await openSidebarTab(0);
  const creativeSection = sectionByHeading("创意饮品策划提交（周三）");
  const textareas = creativeSection.locator("textarea");
  await typeAndBlur(textareas.nth(0), `夜间轻负担饮品推广计划 ${runLabel}`);
  await typeAndBlur(textareas.nth(1), `茉莉轻乳茶与冷萃特饮两款配方 ${runLabel}`);
  await typeAndBlur(textareas.nth(2), `采购奶基底、茶底与冷萃液，验收人 ${studentA.displayName}`);
  await setHiddenFileInput(creativeSection);
  await waitForPreviewCount(creativeSection, 1);
  await creativeSection.getByRole("button", { name: "保存本模块" }).click();

  const week = await waitForWeekCondition(
    studentA.username,
    (item) => item.creative.posters.length === 1 && /REG-/.test(item.creative.marketing),
    "创意策划内容未完整写入周记录。",
  );
  assert.match(week.creative.marketing, /REG-/, "创意策划内容未保存。");
}

async function completeDailyTab() {
  await openSidebarTab(1);
  const dailySection = sectionByHeading("每日打卡与运营执行");
  const timeInputs = dailySection.locator('input[type="time"]');
  const attendanceCard = dailySection.locator("div.soft-card").filter({ hasText: "学生打卡内容" }).first();
  const groomingCard = dailySection.locator("div.soft-card").filter({ hasText: "仪容仪表检查照片" }).first();
  const openingCard = dailySection.locator("div.soft-card").filter({ hasText: "上班前卫生" }).first();
  const closingCard = dailySection.locator("div.soft-card").filter({ hasText: "下班后卫生" }).first();
  const financeCard = dailySection.locator("div.soft-card").filter({ hasText: "财务与库存盘点" }).first();
  const receiptCard = dailySection.locator("div.soft-card").filter({ hasText: "学生购买创意饮品货品签收" }).first();
  await typeAndBlur(timeInputs.nth(0), "08:30");
  await typeAndBlur(timeInputs.nth(1), "17:40");

  await typeAndBlur(dailySection.getByPlaceholder("迟到早退说明、请假情况、导师签字信息"), `到岗正常，交接顺畅。${runLabel}`);
  await typeAndBlur(dailySection.getByPlaceholder("原因、品项、处置"), `报损柠檬 2 个，已复盘。${runLabel}`);
  await typeAndBlur(dailySection.getByPlaceholder("关键库存余量、缺货预警"), `纸杯与茶底充足，注意周末补货。${runLabel}`);
  await typeAndBlur(dailySection.getByPlaceholder("签收品项、数量、签收人、时间"), `创意饮品物料签收完成。${runLabel}`);
  await typeAndBlur(dailySection.getByPlaceholder("客诉、异常、改进事项"), `高峰期分工清晰，继续保持。${runLabel}`);

  await setHiddenFileInput(attendanceCard);
  await waitForPreviewCount(attendanceCard, 1);
  await setHiddenFileInput(groomingCard);
  await waitForPreviewCount(groomingCard, 1);
  await setHiddenFileInput(openingCard, 0);
  await setHiddenFileInput(openingCard, 1);
  await waitForPreviewCount(openingCard, 2);
  await setHiddenFileInput(closingCard, 0);
  await setHiddenFileInput(closingCard, 1);
  await waitForPreviewCount(closingCard, 2);
  await setHiddenFileInput(financeCard, 0);
  await setHiddenFileInput(financeCard, 1);
  await waitForPreviewCount(financeCard, 2);
  await setHiddenFileInput(receiptCard);
  await waitForPreviewCount(receiptCard, 1);

  await dailySection.getByRole("button", { name: "保存当日记录" }).click();

  const week = await waitForWeekCondition(
    studentA.username,
    (item) => {
      const firstKey = Object.keys(item.daily)[0];
      if (!firstKey) return false;
      const firstDay = item.daily[firstKey];
      return firstDay.leaveImgs.length === 1 && firstDay.grooming.length === 1 && firstDay.receiptImgs.length === 1 && /REG-/.test(firstDay.notes);
    },
    "日运营记录未完整写入周记录。",
  );
  const firstDay = week.daily[Object.keys(week.daily)[0]];
  assert.equal(firstDay.leaveImgs.length, 1, "请假条图片未保存。");
  assert.equal(firstDay.grooming.length, 1, "日运营仪容图片未保存。");
  assert.equal(firstDay.receiptImgs.length, 1, "日运营签收图片未保存。");
  assert.match(firstDay.notes, /REG-/, "日运营补充说明未保存。");
}

async function completeHandoverTab() {
  await openSidebarTab(2);
  const handoverSection = sectionByHeading("次周周三交接班");
  await typeAndBlur(handoverSection.getByPlaceholder("本周运营情况、问题清单、下周提醒"), `本周运营稳定，注意下周新品物料盘点。${runLabel}`);
  await typeAndBlur(handoverSection.getByPlaceholder("交接对象姓名或账号"), `交接对象-${runLabel}`);
  await setHiddenFileInput(handoverSection);
  await waitForPreviewCount(handoverSection, 1);
  await handoverSection.getByRole("button", { name: "保存交接记录" }).click();

  const week = await waitForWeekCondition(
    studentA.username,
    (item) => item.handover.photos.length === 1 && /REG-/.test(item.handover.summary),
    "交接记录未完整写入周记录。",
  );
  assert.equal(week.handover.photos.length, 1, "交接图片未保存。");
  assert.match(week.handover.summary, /REG-/, "交接说明未保存。");
}

async function completeReflectionTab() {
  await openSidebarTab(3);
  const reflectionSection = sectionByHeading("总结与反思（周结束）");
  const textareas = reflectionSection.locator("textarea");
  await typeAndBlur(textareas.nth(0), `学员A复盘：服务表达和节奏更稳定。${runLabel}`);
  await typeAndBlur(textareas.nth(1), `学员B复盘：卫生细节与备料判断提升。${runLabel}`);
  await typeAndBlur(textareas.nth(2), `建议继续优化晚高峰出杯和库存提醒。${runLabel}`);
  await reflectionSection.getByRole("button", { name: "保存总结" }).click();

  const week = await waitForWeekCondition(
    studentA.username,
    (item) => /REG-/.test(item.reflection.optPlan),
    "总结与反思未写入周记录。",
  );
  assert.match(week.reflection.optPlan, /REG-/, "总结与反思未保存。");
}

async function previewAndExportReport(downloadPrefix) {
  const [previewPage] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "预览/打印周报" }).first().click(),
  ]);
  await previewPage.waitForLoadState("domcontentloaded");
  await expectVisible(previewPage.getByText("实训周工作报告").first(), "周报预览页未正常打开。");
  await previewPage.screenshot({ path: path.join(artifactDir, `${downloadPrefix}-preview-${timestamp}.png`), fullPage: true });
  await previewPage.close();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出周报 Word" }).first().click(),
  ]);
  const filePath = path.join(downloadDir, `${downloadPrefix}-${timestamp}-${await download.suggestedFilename()}`);
  await download.saveAs(filePath);
  return filePath;
}

async function acknowledgeNoticeAsStudents() {
  const noticeCard = page.locator(".ops-notice-card").filter({ has: page.getByText(noticeTitle) }).first();
  await expectVisible(noticeCard, "登录后未看到带教留言。");
  await noticeCard.getByRole("button", { name: "本组信息收到" }).click();
  await expectVisible(noticeCard.getByRole("button", { name: "已收到" }), "双人登录留言确认未完成。");

  const notice = await waitForNotice(noticeTitle);
  const receiptUsers = new Set(notice.receipts.map((item) => item.username));
  assert(receiptUsers.has(studentA.username), "留言回执未记录学员 A。");
  assert(receiptUsers.has(studentB.username), "留言回执未记录学员 B。");
}

async function editDailyAfterManagerReview() {
  await openSidebarTab(1);
  const dailySection = sectionByHeading("每日打卡与运营执行");
  const groomingCard = dailySection.locator("div.soft-card").filter({ hasText: "仪容仪表检查照片" }).first();
  const notesCard = dailySection.locator("div.soft-card").filter({ hasText: "当日补充说明" }).first();

  await groomingCard.getByRole("button", { name: "删除图片" }).click();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if ((await groomingCard.locator("img.media-preview-item").count()) === 0) break;
    await page.waitForTimeout(200);
  }
  await setHiddenFileInput(groomingCard);
  await waitForPreviewCount(groomingCard, 1);
  await notesCard.getByRole("button", { name: "清空文字" }).click();
  await dailySection.getByRole("button", { name: "保存当日记录" }).click();

  const week = await waitForWeekCondition(
    studentA.username,
    (item) => {
      const firstKey = Object.keys(item.daily)[0];
      if (!firstKey) return false;
      const firstDay = item.daily[firstKey];
      return firstDay.grooming.length === 1
        && !firstDay.approvals.grooming.by
        && !firstDay.approvals.notes.by
        && firstDay.approvals.checkIn.by;
    },
    "P3 删除或修改后，日运营审核状态未按预期重置。",
  );
  const firstDay = week.daily[Object.keys(week.daily)[0]];
  assert.equal(firstDay.grooming.length, 1, "重新上传仪容图片后未写回记录。");
  assert.equal(firstDay.approvals.grooming.by, "", "修改仪容图片后未重置仪容审核。");
  assert.equal(firstDay.approvals.notes.by, "", "清空补充说明后未重置说明审核。");
}

async function reviewUpdatedDailyAsManager() {
  const sidebar = page.locator(".sidebar-shell");
  await sidebar.locator('input[type="date"]').fill(weekStart);
  await sidebar.locator("select").first().selectOption(studentA.username);
  await page.waitForTimeout(1500);
  await sidebar.getByRole("button", { name: "加载/创建本周" }).click();
  await waitForWeekLoaded();

  await openSidebarTab(1);
  const dailySection = sectionByHeading("每日打卡与运营执行");
  const reviewAreas = dailySection.locator(".review-card textarea");
  await typeAndBlur(reviewAreas.nth(2), `仪容图片已重新核验。${runLabel}`);
  await typeAndBlur(reviewAreas.nth(7), `补充说明变更已重新确认。${runLabel}`);
  await dailySection.getByRole("button", { name: "提交仪容确认" }).click();
  await dailySection.getByRole("button", { name: "提交补充说明确认" }).click();

  const week = await waitForWeekCondition(
    studentA.username,
    (item) => {
      const firstKey = Object.keys(item.daily)[0];
      if (!firstKey) return false;
      const firstDay = item.daily[firstKey];
      return Boolean(firstDay.approvals.grooming.by && firstDay.approvals.notes.by);
    },
    "P2 未重新完成已修改日运营项的审核。",
  );
  const firstDay = week.daily[Object.keys(week.daily)[0]];
  assert(firstDay.approvals.grooming.by, "仪容项重新审核未写回。");
  assert(firstDay.approvals.notes.by, "补充说明重新审核未写回。");
}

async function confirmDailyByStudents() {
  await openSidebarTab(1);
  const dailySection = sectionByHeading("每日打卡与运营执行");
  const confirmButtons = dailySection.getByRole("button", { name: "P3 确认通过" });
  const total = await confirmButtons.count();
  assert(total >= 8, "未找到完整的 P3 回签按钮。");
  for (let index = 0; index < total; index += 1) {
    await confirmButtons.nth(index).click();
  }

  const week = await waitForWeekCondition(
    studentA.username,
    (item) => {
      const firstKey = Object.keys(item.daily)[0];
      if (!firstKey) return false;
      const firstDay = item.daily[firstKey];
      const confirmations = Object.values(firstDay.studentConfirmations || {});
      return confirmations.filter((entry) => entry.by && entry.time).length >= 8;
    },
    "P3 回签未完整写入周记录。",
  );
  const firstDay = week.daily[Object.keys(week.daily)[0]];
  const confirmations = firstDay.studentConfirmations;
  const confirmedKeys = Object.values(confirmations).filter((item) => item.by && item.time);
  assert(confirmedKeys.length >= 8, "P3 回签未完整写入周记录。");
}

async function reviewAsManager() {
  await waitForWeekCondition(
    studentA.username,
    (item) => /REG-/.test(item.creative.marketing),
    "进入经理审核前，学生创意数据未写入后端。",
  );

  const sidebar = page.locator(".sidebar-shell");
  await sidebar.locator('input[type="date"]').fill(weekStart);
  await sidebar.locator("select").first().selectOption(studentA.username);
  await page.waitForTimeout(1500);
  await sidebar.getByRole("button", { name: "加载/创建本周" }).click();
  await waitForWeekLoaded();

  await openSidebarTab(0);
  const creativeSection = sectionByHeading("创意饮品策划提交（周三）");
  const creativeApproveButton = creativeSection.getByRole("button", { name: "运营经理确认本模块" });
  await waitForButtonEnabled(creativeApproveButton, "经理视图未加载出可确认的创意模块数据。");
  await creativeApproveButton.click();
  await waitForWeekCondition(
    studentA.username,
    (item) => Boolean(item.creative.approval.by),
    "创意模块经理确认未写入周记录。",
  );

  await openSidebarTab(1);
  const dailySection = sectionByHeading("每日打卡与运营执行");
  const reviewTexts = [
    "签到情况属实，准时到岗。",
    "签退信息属实，交接完整。",
    "仪容仪表合格。",
    "开店卫生达标。",
    "闭店卫生达标。",
    "财务与库存核验通过。",
    "签收记录核验通过。",
    "补充说明已核验。",
  ];
  const reviewAreas = dailySection.locator(".review-card textarea");
  for (let index = 0; index < reviewTexts.length; index += 1) {
    await typeAndBlur(reviewAreas.nth(index), `${reviewTexts[index]} ${runLabel}`);
  }
  const submitButtons = [
    "提交签到确认",
    "提交签退确认",
    "提交仪容确认",
    "提交开店卫生确认",
    "提交闭店卫生确认",
    "提交财务库存确认",
    "提交签收确认",
    "提交补充说明确认",
  ];
  for (const name of submitButtons) {
    await dailySection.getByRole("button", { name }).click();
  }
  await waitForWeekCondition(
    studentA.username,
    (item) => {
      const firstKey = Object.keys(item.daily)[0];
      if (!firstKey) return false;
      const firstDay = item.daily[firstKey];
      return Boolean(
        firstDay.approvals.checkIn.by
        && firstDay.approvals.checkOut.by
        && firstDay.approvals.grooming.by
        && firstDay.approvals.opening.by
        && firstDay.approvals.closing.by
        && firstDay.approvals.finance.by
        && firstDay.approvals.receipt.by
        && firstDay.approvals.notes.by,
      );
    },
    "日运营经理审核未完整写入周记录。",
  );

  await openSidebarTab(2);
  const handoverSection = sectionByHeading("次周周三交接班");
  await handoverSection.getByRole("button", { name: "经理确认交接" }).click();
  await waitForWeekCondition(
    studentA.username,
    (item) => Boolean(item.handover.approval.by),
    "交接模块经理确认未写入周记录。",
  );

  await openSidebarTab(3);
  const reflectionSection = sectionByHeading("总结与反思（周结束）");
  await typeAndBlur(reflectionSection.locator("textarea").nth(3), `经理评语：本周执行完整，回归链路通过。${runLabel}`);
  await reflectionSection.getByRole("button", { name: "保存经理评语" }).click();
  await reflectionSection.getByRole("button", { name: "经理最终确认" }).click();
  await waitForWeekCondition(
    studentA.username,
    (item) => Boolean(item.reflection.approval.by),
    "总结模块经理最终确认未写入周记录。",
  );

  const week = await waitForWeekCondition(
    studentA.username,
    (item) => {
      const firstKey = Object.keys(item.daily)[0];
      if (!firstKey) return false;
      const firstDay = item.daily[firstKey];
      return Boolean(
        item.creative.approval.by
        && firstDay.approvals.checkIn.by
        && item.handover.approval.by
        && item.reflection.approval.by,
      );
    },
    "经理审核链路未完整写入周记录。",
  );
  assert(week.creative.approval.by, "创意模块未完成经理确认。");
  const firstDay = week.daily[Object.keys(week.daily)[0]];
  assert(firstDay.approvals.checkIn.by, "日运营签到未完成经理确认。");
  assert(week.handover.approval.by, "交接模块未完成经理确认。");
  assert(week.reflection.approval.by, "总结模块未完成经理最终确认。");
}

async function cleanupRemoteArtifacts() {
  if (createdNoticeId) {
    await apiRequest(`/teacher-notices/${encodeURIComponent(createdNoticeId)}`, { method: "DELETE" }).catch(() => {});
  }

  if (accountsCreated) {
    await apiRequest(`/accounts/${encodeURIComponent(studentA.username)}`, { method: "DELETE" }).catch(() => {});
    await apiRequest(`/accounts/${encodeURIComponent(studentB.username)}`, { method: "DELETE" }).catch(() => {});
    await apiRequest(`/accounts/${encodeURIComponent(managerAccount.username)}`, { method: "DELETE" }).catch(() => {});
  }

  await apiRequest(`/week-groups/${encodeURIComponent(weekStart)}`, {
    method: "PUT",
    body: JSON.stringify({
      group: {
        teachingWeek: "",
        a: "",
        b: "",
        nextGroup: "",
      },
    }),
  }).catch(() => {});
}

try {
  await openFreshPublicHome();
  await expectTextVisible("Travelologist Coffee OPS System", "门户首页文案未更新。");
  await expectVisible(page.locator(".portal-enter-button"), "门户首页未显示点击进入按钮。");

  await enterPortalIfNeeded();
  p1Account = await getAvailableP1Account();
  reviewerAccount = await getAvailableReviewerAccount();
  await loginAs(p1Account);
  await expectVisible(page.locator(".ops-shell-auth"), "P1 登录后未进入工作台。");

  await createTeacherNotice();
  await createRegressionAccountsViaUI();
  await screenshot("public-regression-p1-setup");
  await logout();

  const publicNoticeCard = page.locator(".ops-notice-card").filter({ has: page.getByText(noticeTitle) }).first();
  await expectVisible(publicNoticeCard, "登出后未看到公开留言卡片。");
  await expectVisible(publicNoticeCard.getByText("登录后可点击信息收到"), "登录前未显示留言提示。");

  await loginAs({
    username: studentA.username,
    password: studentA.password,
    secondUsername: studentB.username,
    secondPassword: studentB.password,
  });
  await expectVisible(page.locator(".ops-shell-auth"), "学生双人登录后未进入工作台。");
  await acknowledgeNoticeAsStudents();
  await prepareWeekForStudents();
  await completeCreativeTab();
  await completeDailyTab();
  await completeHandoverTab();
  await completeReflectionTab();
  const studentReportPath = await previewAndExportReport("public-student");
  await screenshot("public-regression-student");
  await logout();

  await loginAs(reviewerAccount);
  await expectVisible(page.locator(".ops-shell-auth"), "审核账号登录失败。");
  await reviewAsManager();
  const managerReportPath = await previewAndExportReport("public-manager");
  await screenshot("public-regression-manager");
  await logout();

  await loginAs({
    username: studentA.username,
    password: studentA.password,
    secondUsername: studentB.username,
    secondPassword: studentB.password,
  });
  await loadRegressionWeekForCurrentSession();
  await editDailyAfterManagerReview();
  await logout();

  await loginAs(reviewerAccount);
  await expectVisible(page.locator(".ops-shell-auth"), "审核账号二次登录失败。");
  await reviewUpdatedDailyAsManager();
  await logout();

  await loginAs({
    username: studentA.username,
    password: studentA.password,
    secondUsername: studentB.username,
    secondPassword: studentB.password,
  });
  await loadRegressionWeekForCurrentSession();
  await confirmDailyByStudents();
  await screenshot("public-regression-student-signoff");
  await logout();

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        weekStart,
        accounts: {
          studentA: studentA.username,
          studentB: studentB.username,
          manager: managerAccount.username,
        },
        noticeTitle,
        artifacts: {
          studentReportPath,
          managerReportPath,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  await screenshot("public-regression-error").catch(() => {});
  throw error;
} finally {
  await cleanupRemoteArtifacts();
  await context.close();
  await browser.close();
}
