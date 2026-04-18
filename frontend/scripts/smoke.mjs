import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright-core";

const baseUrl = process.env.APP_URL || "http://127.0.0.1:8000";
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const workspaceRoot = path.resolve(process.cwd(), "..");
const artifactDir = path.join(workspaceRoot, ".smoke-artifacts");
const downloadDir = path.join(artifactDir, "downloads");
const uploadFixture = path.join(workspaceRoot, "_hygiene_preview.png");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const noteSuffix = `SMOKE-${timestamp}`;
const runAccountAudit = process.env.RUN_ACCOUNT_AUDIT === "1";

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

async function expectVisible(locator, message) {
  await locator.waitFor({ state: "visible", timeout: 20000 });
  assert(await locator.isVisible(), message);
}

async function typeAndBlur(locator, value) {
  await locator.fill(value);
  try {
    await locator.evaluate((node) => node.blur());
  } catch {
    // React re-render can replace the input node immediately after fill.
  }
}

async function ensureTextVisible(text) {
  await page.locator(`text=${text}`).first().waitFor({ state: "visible", timeout: 20000 });
}

function sectionByHeading(name) {
  return page.getByRole("heading", { name, exact: true }).last().locator("xpath=ancestor::section[1]");
}

async function chooseFiles(scope, buttonName, filePath = uploadFixture) {
  const marker = `smoke-target-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const matched = await scope.evaluate((node, payload) => {
    const buttons = Array.from(node.querySelectorAll("button"));
    const targetButton = buttons.find((button) => button.textContent?.trim() === payload.buttonName);
    const targetInput = targetButton?.previousElementSibling;
    if (!(targetInput instanceof HTMLInputElement) || targetInput.type !== "file") {
      return false;
    }
    targetInput.setAttribute("data-smoke-target", payload.marker);
    return true;
  }, { buttonName, marker });

  if (matched) {
    const input = page.locator(`input[data-smoke-target="${marker}"]`);
    await input.setInputFiles(filePath);
    await input.evaluate((node) => node.removeAttribute("data-smoke-target"));
    return;
  }

  const button = scope.getByRole("button", { name: buttonName, exact: true }).first();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    button.click(),
  ]);
  await chooser.setFiles(filePath);
}

async function loginAs({ username, password, secondUsername = "", secondPassword = "" }) {
  const enterButton = page.getByRole("button", { name: "点击进入" });
  if (await enterButton.isVisible().catch(() => false)) {
    await enterButton.click();
  }
  await expectVisible(page.getByRole("heading", { name: "登录" }), "登录面板未显示");
  await typeAndBlur(page.getByPlaceholder("请输入账号，例如 2401270101").first(), username);
  await typeAndBlur(page.getByPlaceholder("请输入密码").first(), password);

  if (secondUsername || secondPassword) {
    await typeAndBlur(page.getByPlaceholder("同组双人登录时填写第二个账号").first(), secondUsername);
    await typeAndBlur(page.getByPlaceholder("与第二个账号配套填写").first(), secondPassword);
  }

  await page.getByRole("button", { name: "登录系统" }).click();
}

async function logout() {
  await page.getByRole("button", { name: "退出登录" }).click();
  await expectVisible(page.getByRole("heading", { name: "登录" }), "退出登录后未回到登录页");
}

async function openTab(name) {
  await page.getByRole("button", { name, exact: true }).first().click();
}

async function expectUploadedPreview(section) {
  await expectVisible(section.locator('img[src^="data:image"]').first(), "图片预览未显示");
}

async function assertButtonDisabled(locator, message) {
  assert(await locator.isDisabled(), message);
}

async function waitForButtonEnabled(locator, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!(await locator.isDisabled())) return;
    await page.waitForTimeout(200);
  }
  assert.fail(message);
}

async function waitForOptionRemoved(locator, value, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const exists = await locator.locator(`option[value="${value}"]`).count();
    if (!exists) return;
    await page.waitForTimeout(200);
  }
  assert.fail(message);
}

async function runAccountsAudit() {
  const tempUser = `99${timestamp.replace(/\D/g, "").slice(-8)}`;
  const createdPassword = `Temp@${timestamp.slice(-6)}`;
  const editedPassword = `${createdPassword}A`;
  const finalPassword = `${createdPassword}B`;

  await openTab("账号管理");
  const accountsSection = sectionByHeading("账号管理");
  await expectVisible(accountsSection, "账号管理页面未打开");
  await expectVisible(accountsSection.locator('text=P1 账号管理（最高权限）').first(), "P1管理卡片未显示");
  const cards = accountsSection.locator(".soft-card");
  const createCard = cards.nth(1);
  const editCard = cards.nth(2);

  const createInputs = createCard.locator("input");
  await typeAndBlur(createInputs.nth(0), tempUser);
  await typeAndBlur(createInputs.nth(1), "巡检账号");
  await typeAndBlur(createInputs.nth(2), createdPassword);
  await createCard.locator("select").selectOption("P3");
  await createCard.getByRole("button", { name: "新增账号" }).click();
  await ensureTextVisible(`已新增账号：${tempUser}`);

  await openTab("账号管理");
  const accountsSectionAfterCreate = sectionByHeading("账号管理");
  await expectVisible(accountsSectionAfterCreate, "新增账号后账号管理页面未保持可见");
  const editCardAfterCreate = accountsSectionAfterCreate.locator(".soft-card").nth(2);
  await editCardAfterCreate.locator("select").selectOption(tempUser);
  const editInputs = editCardAfterCreate.locator("input");
  await typeAndBlur(editInputs.nth(0), "巡检账号已编辑");
  await typeAndBlur(editInputs.nth(1), editedPassword);
  await editCardAfterCreate.getByRole("button", { name: "保存账号修改" }).click();
  await ensureTextVisible(`已更新账号：${tempUser}`);

  await logout();
  await loginAs({ username: tempUser, password: editedPassword });
  await expectVisible(page.getByRole("button", { name: "账号管理" }), "新增账号无法登录");

  await openTab("账号管理");
  const accountsSectionForPassword = sectionByHeading("账号管理");
  const passwordCard = accountsSectionForPassword.locator(".soft-card").first();
  await typeAndBlur(passwordCard.locator('input[type="password"]').first(), finalPassword);
  await passwordCard.getByRole("button", { name: "修改密码" }).click();
  await ensureTextVisible("密码已修改。");

  await logout();
  await loginAs({ username: tempUser, password: finalPassword });
  await expectVisible(page.getByRole("button", { name: "退出登录" }), "修改密码后新账号无法重新登录");
  await logout();

  await loginAs({
    username: "103085",
    password: "103085",
  });
  await openTab("账号管理");
  const accountsSectionRelogin = sectionByHeading("账号管理");
  await expectVisible(accountsSectionRelogin, "删除账号前未回到账号管理页");
  const editCardAfterRelogin = accountsSectionRelogin.locator(".soft-card").nth(2);
  await editCardAfterRelogin.locator("select").selectOption("103085");
  await expectVisible(editCardAfterRelogin.getByText("不能删除当前登录账号").first(), "当前登录账号删除提示未显示");
  await assertButtonDisabled(editCardAfterRelogin.getByRole("button", { name: "删除账号" }), "当前登录账号的删除按钮应禁用");
  await editCardAfterRelogin.locator("select").selectOption(tempUser);
  await waitForButtonEnabled(editCardAfterRelogin.getByRole("button", { name: "删除账号" }), "切换到目标账号后删除按钮未启用");
  page.once("dialog", (dialog) => dialog.accept());
  await editCardAfterRelogin.getByRole("button", { name: "删除账号" }).click();
  await waitForOptionRemoved(editCardAfterRelogin.locator("select"), tempUser, "删除账号后账号选项未移除");
  await logout();
  await loginAs({ username: tempUser, password: finalPassword });
  await ensureTextVisible("账号或密码错误。");

  return { tempUser };
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await loginAs({
    username: "2401270101",
    password: "2401270101",
    secondUsername: "2401270106",
    secondPassword: "2401270106",
  });

  await expectVisible(page.getByRole("button", { name: "退出登录" }), "学生登录后未进入主界面");
  await ensureTextVisible("双人登录成功。已自动加载本周轮值并同步到本组账号。");

  await page.getByRole("button", { name: "加载/创建本周", exact: true }).first().click();
  await ensureTextVisible("已加载所选周次。");

  const sidebarSelects = page.locator("aside select");
  await sidebarSelects.last().selectOption("第15周");
  await page.getByRole("button", { name: "保存分组" }).click();
  await ensureTextVisible("分组信息已保存，并自动带入当周学生第一天数据。");

  await openTab("创意策划");
  const creativeSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "创意饮品策划提交（周三）", exact: true }) }).first();
  await typeAndBlur(page.getByPlaceholder("目标人群、推广渠道、售价策略、试饮安排"), `主打校园晚课轻负担饮品 ${noteSuffix}`);
  await typeAndBlur(page.getByPlaceholder("2 款饮品配方、克数、制作步骤、标准化要点"), `茉莉轻乳茶与柠香冷萃两款新品，记录于 ${noteSuffix}`);
  await typeAndBlur(page.getByPlaceholder("品名、规格、数量、预算、采购时间、验收人"), `轻乳、茉莉茶底、冷萃液，预算120元，验收人周露，${noteSuffix}`);
  await chooseFiles(creativeSection, "添加海报图片");
  await ensureTextVisible("已保存：周三策划提交模块。");
  await expectUploadedPreview(creativeSection);
  await creativeSection.getByRole("button", { name: "保存本模块" }).click();
  await ensureTextVisible("已保存：周三策划提交模块。");

  await openTab("日常运营");
  const dailySection = page.locator("section").filter({ has: page.getByRole("heading", { name: "每日打卡与运营执行", exact: true }) }).first();
  const groomingCard = dailySection.locator('div:has(> h3:has-text("仪容仪表检查照片"))').first();
  const openingCard = dailySection.locator('div:has(> h3:has-text("上班前卫生"))').first();
  const closingCard = dailySection.locator('div:has(> h3:has-text("下班后卫生"))').first();
  const financeCard = dailySection.locator('div:has(> h3:has-text("财务与库存盘点（含损耗、库存照片）"))').first();
  const receiptCard = dailySection.locator('div:has(> h3:has-text("学生购买创意饮品货品签收"))').first();
  const timeInputs = dailySection.locator('input[type="time"]');
  await typeAndBlur(timeInputs.nth(0), "08:30");
  await typeAndBlur(timeInputs.nth(1), "17:30");
  await typeAndBlur(page.getByPlaceholder("迟到早退说明、请假情况、导师签字信息"), `按时到岗，无异常，${noteSuffix}`);

  const numberInputs = dailySection.locator('input[type="number"]');
  await typeAndBlur(numberInputs.nth(0), "358");
  await typeAndBlur(numberInputs.nth(1), "126");
  await typeAndBlur(numberInputs.nth(2), "12");
  await typeAndBlur(page.getByPlaceholder("原因、品项、处置"), `柠檬损耗2个，已复盘，${noteSuffix}`);
  await typeAndBlur(page.getByPlaceholder("关键库存余量、缺货预警"), `茶底充足，提醒补充纸杯，${noteSuffix}`);
  await typeAndBlur(page.getByPlaceholder("签收品项、数量、签收人、时间"), `创意饮品原料签收完成，${noteSuffix}`);
  await typeAndBlur(page.getByPlaceholder("客诉、异常、改进事项"), `高峰期补位顺畅，继续保持，${noteSuffix}`);

  await chooseFiles(groomingCard, "添加照片");
  await ensureTextVisible("已保存：");
  await chooseFiles(openingCard, "添加公区照片");
  await ensureTextVisible("已保存：");
  await chooseFiles(openingCard, "添加吧台照片");
  await ensureTextVisible("已保存：");
  await chooseFiles(closingCard, "添加公区照片");
  await ensureTextVisible("已保存：");
  await chooseFiles(closingCard, "添加吧台照片");
  await ensureTextVisible("已保存：");
  await chooseFiles(financeCard, "添加损耗照片");
  await ensureTextVisible("已保存：");
  await chooseFiles(financeCard, "添加库存照片");
  await ensureTextVisible("已保存：");
  await chooseFiles(receiptCard, "添加签收照片");
  await ensureTextVisible("已保存：");
  await expectUploadedPreview(groomingCard);
  await expectUploadedPreview(openingCard);
  await expectUploadedPreview(closingCard);
  await expectUploadedPreview(financeCard);
  await expectUploadedPreview(receiptCard);
  await dailySection.getByRole("button", { name: "保存当日记录" }).click();
  await ensureTextVisible("当日记录");

  await openTab("班次交接");
  const handoverSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "次周周三交接班", exact: true }) }).first();
  await typeAndBlur(page.getByPlaceholder("本周运营情况、问题清单、下周提醒"), `本周销售稳定，注意补货和高峰分工，${noteSuffix}`);
  await typeAndBlur(page.getByPlaceholder("交接对象姓名或账号"), "刘梓文");
  await chooseFiles(handoverSection, "添加交接照片");
  await expectUploadedPreview(handoverSection);
  await handoverSection.getByRole("button", { name: "保存交接记录" }).click();
  await ensureTextVisible("已保存：交接记录。");

  await openTab("总结复盘");
  const reflectionSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "总结与反思（周结束）", exact: true }) }).first();
  const reflectionAreas = reflectionSection.locator("textarea");
  await typeAndBlur(reflectionAreas.nth(0), `学生A复盘：时间管理更稳定，${noteSuffix}`);
  await typeAndBlur(reflectionAreas.nth(1), `学生B复盘：卫生细节与销售表达有提升，${noteSuffix}`);
  await typeAndBlur(reflectionAreas.nth(2), `建议继续优化高峰出杯动线与库存提醒，${noteSuffix}`);
  await reflectionSection.getByRole("button", { name: "保存总结" }).click();
  await ensureTextVisible("已保存：总结与反思。");

  const [previewPage] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "预览/打印周报" }).click(),
  ]);
  await previewPage.waitForLoadState("domcontentloaded");
  await previewPage.locator("text=实训周工作报告").waitFor({ timeout: 20000 });
  await previewPage.screenshot({ path: path.join(artifactDir, `report-preview-${timestamp}.png`), fullPage: true });
  await previewPage.close();

  const [studentDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出周报 Word" }).click(),
  ]);
  const studentReportPath = path.join(downloadDir, `${timestamp}-student-${await studentDownload.suggestedFilename()}`);
  await studentDownload.saveAs(studentReportPath);

  await logout();

  await loginAs({
    username: "2301180107",
    password: "2301180107",
  });

  await expectVisible(page.getByRole("button", { name: "退出登录" }), "经理登录后未进入主界面");
  const managerScopeSelect = page.locator("aside select").nth(1);
  await managerScopeSelect.selectOption("2401270101");
  await ensureTextVisible("已切换查看：2401270101");
  await page.getByRole("button", { name: "加载/创建本周", exact: true }).first().click();
  await ensureTextVisible("已加载所选周次。");

  await openTab("创意策划");
  await creativeSection.getByRole("button", { name: "运营经理确认本模块" }).click();
  await ensureTextVisible("已确认：周三策划提交。");
  await expectVisible(creativeSection.locator("text=已确认：").first(), "创意策划确认状态未更新");

  await openTab("日常运营");
  const managerDailySection = page.locator("section").filter({ has: page.getByRole("heading", { name: "每日打卡与运营执行", exact: true }) }).first();
  await groomingCard.getByRole("button", { name: "提交仪容确认" }).click();
  await expectVisible(groomingCard.locator("text=已确认：").first(), "仪容仪表确认状态未更新");
  await managerDailySection.getByRole("button", { name: "提交签到确认" }).click();
  await ensureTextVisible("已确认：签到时间。");
  await managerDailySection.getByRole("button", { name: "提交签退确认" }).click();
  await ensureTextVisible("已确认：签退时间。");
  await openingCard.getByRole("button", { name: "提交开店卫生确认" }).click();
  await expectVisible(openingCard.locator("text=已确认：").first(), "上班前卫生确认状态未更新");
  await closingCard.getByRole("button", { name: "提交闭店卫生确认" }).click();
  await expectVisible(closingCard.locator("text=已确认：").first(), "下班后卫生确认状态未更新");
  await financeCard.getByRole("button", { name: "提交财务库存确认" }).click();
  await expectVisible(financeCard.locator("text=已确认：").first(), "财务与库存确认状态未更新");
  await receiptCard.getByRole("button", { name: "提交签收确认" }).click();
  await expectVisible(receiptCard.locator("text=已确认：").first(), "货品签收确认状态未更新");

  await openTab("班次交接");
  await handoverSection.getByRole("button", { name: "经理确认交接" }).click();
  await ensureTextVisible("已确认：交接班。");
  await expectVisible(handoverSection.locator("text=已确认：").first(), "交接确认状态未更新");

  await openTab("总结复盘");
  await typeAndBlur(reflectionSection.locator("textarea").nth(3), `经理评语：本周执行完整，保持复盘节奏，${noteSuffix}`);
  await reflectionSection.getByRole("button", { name: "保存经理评语" }).click();
  await ensureTextVisible("已保存：经理评语。");
  await reflectionSection.getByRole("button", { name: "经理最终确认" }).click();
  await ensureTextVisible("已确认：周总结。");
  await expectVisible(reflectionSection.locator("text=已确认：").first(), "总结确认状态未更新");

  const [managerDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出周报 Word" }).click(),
  ]);
  const managerReportPath = path.join(downloadDir, `${timestamp}-manager-${await managerDownload.suggestedFilename()}`);
  await managerDownload.saveAs(managerReportPath);

  let accountAuditResult = null;
  if (runAccountAudit) {
    await logout();
    await loginAs({
      username: "103085",
      password: "103085",
    });
    await expectVisible(page.getByRole("button", { name: "账号管理" }), "P1账号未进入主界面");
    accountAuditResult = await runAccountsAudit();
  }

  await page.screenshot({ path: path.join(artifactDir, `smoke-final-${timestamp}.png`), fullPage: true });

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        artifacts: {
          studentReportPath,
          managerReportPath,
          screenshot: path.join(artifactDir, `smoke-final-${timestamp}.png`),
          previewScreenshot: path.join(artifactDir, `report-preview-${timestamp}.png`),
        },
        accountAuditResult,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: path.join(artifactDir, `smoke-error-${timestamp}.png`), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
