import { ensureDayOnWeek, ensureWeekStructure, escapeHtml, getWeekDates, PROCESS_ITEM_DEFINITIONS, renderApprovalText, trim } from "./reportHelpers.js";

function formatRichText(value, fallback = "-") {
  const safe = escapeHtml(value);
  return safe ? safe.replace(/\n/g, "<br/>") : fallback;
}

function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s{2,}/g, " ").trim())}`;
}

function reportArt(kind, title = "", subtitle = "") {
  const main = escapeHtml(title);
  const sub = escapeHtml(subtitle);
  const themes = {
    cover: { a: "#784421", b: "#d6922b", c: "#2e8f88", d: "#f6efe2" },
    creative: { a: "#9c5b12", b: "#f0c978", c: "#d96d41", d: "#fff8ef" },
    daily: { a: "#2b6b88", b: "#8fc8d6", c: "#58a89a", d: "#eef8fa" },
    handover: { a: "#5c4a7a", b: "#c8b8ec", c: "#8f7ad8", d: "#f5f1ff" },
    reflection: { a: "#4f6b2f", b: "#c7df90", c: "#91ad54", d: "#f6faee" },
    gallery: { a: "#6e4b2d", b: "#dfc6a2", c: "#b98c54", d: "#fbf7f0" },
  };
  const theme = themes[kind] || themes.gallery;
  const iconMap = {
    cover: `
      <circle cx="498" cy="88" r="42" fill="${theme.b}" opacity=".95"/>
      <path d="M434 154c18-40 58-67 104-67 17 0 35 4 48 12-10 43-49 75-96 75-22 0-40-7-56-20z" fill="${theme.c}" opacity=".92"/>
      <rect x="120" y="72" rx="28" ry="28" width="126" height="128" fill="rgba(255,255,255,.85)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M148 113c5-14 18-24 34-24h4c16 0 29 10 34 24l11 38c4 14-6 28-20 28h-58c-15 0-25-14-21-28z" fill="${theme.a}"/>
      <path d="M165 112c0-10 8-18 18-18h26c10 0 18 8 18 18v11h-62z" fill="${theme.c}"/>
      <path d="M245 116c18 0 31 13 31 29 0 16-13 29-31 29" fill="none" stroke="${theme.a}" stroke-width="10" stroke-linecap="round"/>
    `,
    creative: `
      <rect x="405" y="58" width="126" height="108" rx="24" fill="rgba(255,255,255,.86)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M432 112c9-18 23-28 42-28 21 0 36 10 46 28l9 24c6 16-6 30-23 30h-63c-17 0-28-16-22-31z" fill="${theme.c}"/>
      <path d="M455 92c6 5 10 12 11 20 8-7 18-10 29-9-5 4-9 10-10 16 9 1 17 5 24 12-11 1-20 5-29 12-5-9-13-16-25-21z" fill="${theme.b}" opacity=".9"/>
      <circle cx="148" cy="112" r="52" fill="rgba(255,255,255,.75)"/>
      <path d="M120 136c23-33 44-50 68-55-6 18-16 34-32 49 10 2 18 8 26 16-24 0-44-4-62-10z" fill="${theme.a}" opacity=".88"/>
    `,
    daily: `
      <rect x="400" y="54" width="134" height="118" rx="22" fill="rgba(255,255,255,.9)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M433 88h66" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M433 118h46" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M433 148h58" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M414 90l8 9 15-18" fill="none" stroke="${theme.c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M414 120l8 9 15-18" fill="none" stroke="${theme.c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="154" cy="112" r="54" fill="rgba(255,255,255,.78)"/>
      <path d="M124 142h61c9 0 15-8 13-16l-8-34c-4-18-19-31-38-31s-34 13-38 31l-5 22c-3 15 8 28 23 28z" fill="${theme.c}"/>
      <path d="M117 162h89" stroke="${theme.a}" stroke-width="10" stroke-linecap="round"/>
    `,
    handover: `
      <rect x="88" y="56" width="138" height="124" rx="18" fill="rgba(255,255,255,.88)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M118 92h79M118 120h79M118 148h54" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M282 116h116" stroke="${theme.c}" stroke-width="12" stroke-linecap="round"/>
      <path d="M378 88l40 28-40 28" fill="none" stroke="${theme.c}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="430" y="72" width="90" height="90" rx="22" fill="rgba(255,255,255,.84)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M453 138h44M453 116h44M453 94h28" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
    `,
    reflection: `
      <circle cx="148" cy="112" r="56" fill="rgba(255,255,255,.82)"/>
      <path d="M132 78h32v31c0 10-7 18-16 18s-16-8-16-18z" fill="${theme.a}"/>
      <path d="M120 80h12v18c0 8-5 14-12 14M176 80h-12v18c0 8 5 14 12 14" fill="none" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M130 142h36M120 162h56" stroke="${theme.c}" stroke-width="10" stroke-linecap="round"/>
      <rect x="394" y="58" width="138" height="112" rx="20" fill="rgba(255,255,255,.88)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M424 92h79M424 121h79M424 150h58" stroke="${theme.c}" stroke-width="8" stroke-linecap="round"/>
    `,
    gallery: `
      <rect x="88" y="60" width="140" height="112" rx="18" fill="rgba(255,255,255,.84)" stroke="${theme.a}" stroke-width="4"/>
      <circle cx="136" cy="99" r="16" fill="${theme.b}"/>
      <path d="M105 155l27-28 24 19 16-14 39 23" fill="none" stroke="${theme.c}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="370" y="74" width="154" height="82" rx="20" fill="rgba(255,255,255,.78)" stroke="${theme.a}" stroke-dasharray="10 8" stroke-width="4"/>
      <path d="M415 116h66" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
    `,
  };

  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="320" viewBox="0 0 960 320">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.d}"/>
          <stop offset="55%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="${theme.b}"/>
        </linearGradient>
      </defs>
      <rect width="960" height="320" rx="34" fill="url(#bg)"/>
      <circle cx="822" cy="58" r="92" fill="${theme.b}" opacity=".22"/>
      <circle cx="104" cy="264" r="84" fill="${theme.c}" opacity=".18"/>
      <rect x="28" y="26" width="904" height="268" rx="28" fill="none" stroke="${theme.a}" stroke-opacity=".18" stroke-width="2"/>
      ${iconMap[kind] || iconMap.gallery}
      <text x="306" y="120" font-size="38" font-family="Microsoft YaHei, sans-serif" font-weight="700" fill="${theme.a}">${main}</text>
      <text x="306" y="170" font-size="20" font-family="Microsoft YaHei, sans-serif" fill="#5d5142">${sub}</text>
      <text x="306" y="214" font-size="14" font-family="Microsoft YaHei, sans-serif" fill="#8a765f">实训成果归档</text>
    </svg>
  `);
}

function renderReportGallery(images, emptyKind, emptyText, large = false) {
  if (images && images.length) {
    return `<div class="gallery">${images.map((src) => `<img src="${src}" class="${large ? "gallery-image large" : "gallery-image"}" />`).join("")}</div>`;
  }
  return `<div class="empty-gallery"><img src="${reportArt(emptyKind, "AI视觉补位", emptyText)}" class="empty-art" /><div class="empty-copy">${escapeHtml(emptyText)}</div></div>`;
}

function renderDrinkSummary(drink, index) {
  return `
    <div class="sub-card">
      <h4>创意饮品 ${index + 1}${drink.name ? ` · ${escapeHtml(drink.name)}` : ""}</h4>
      <p><b>类型：</b>${formatRichText(drink.type)}</p>
      <p><b>创意来源：</b>${formatRichText(drink.inspiration)}</p>
      <p><b>原料清单：</b>${formatRichText(drink.ingredients)}</p>
      <p><b>配方比例：</b>${formatRichText(drink.ratio)}</p>
      <p><b>制作步骤：</b>${formatRichText(drink.steps)}</p>
      <p><b>特殊物料：</b>${formatRichText(drink.specialMaterials)}</p>
      <p><b>备注：</b>${formatRichText(drink.notes)}</p>
      <div class="gallery-pair">
        <div>
          <h5>成品图</h5>
          ${renderReportGallery(drink.productImages, "creative", "未上传成品图，已使用 AI 饮品视觉示意。")}
        </div>
        <div>
          <h5>海报图</h5>
          ${renderReportGallery(drink.posterImages, "creative", "未上传海报图，已使用 AI 海报视觉示意。")}
        </div>
      </div>
    </div>
  `;
}

function renderProcurementTable(items) {
  const validItems = (items || []).filter((item) => Object.values(item || {}).some((value) => trim(value)));
  if (!validItems.length) {
    return `<p>-</p>`;
  }

  const rows = validItems.map((item) => `
    <tr>
      <td>${escapeHtml(item.name || "-")}</td>
      <td>${escapeHtml(item.spec || "-")}</td>
      <td>${escapeHtml(item.quantity || "-")}</td>
      <td>${escapeHtml(item.unitPrice || "-")}</td>
      <td>${escapeHtml(item.subtotal || "-")}</td>
      <td>${escapeHtml(item.notes || "-")}</td>
    </tr>
  `).join("");

  return `
    <table class="report-table">
      <thead>
        <tr>
          <th>名称</th>
          <th>规格</th>
          <th>数量</th>
          <th>单价</th>
          <th>金额小计</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderScoreValue(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return escapeHtml(String(value));
}

export function buildReportHtml({ week, group, scopeUser, exportProfile = {}, scoreSummary = {} }) {
  const normalizedWeek = ensureWeekStructure(week, week?.startDate);
  const dates = getWeekDates(normalizedWeek.startDate);
  const teachingWeekText = trim(group?.teachingWeek) || "未设置";
  const studentNames = [normalizedWeek.members.a, normalizedWeek.members.b].map(trim).filter(Boolean);
  const reportOwners = studentNames.length ? studentNames.join("、") : escapeHtml(scopeUser || "本周学员");
  const coverImage = reportArt("cover", "实践周实训手册", "门店创意饮品策划与运营实践");
  const studentName = trim(exportProfile.studentName) || trim(normalizedWeek.members.a) || trim(scopeUser) || reportOwners;
  const studentUsername = trim(exportProfile.studentUsername) || trim(scopeUser);
  const className = trim(exportProfile.className);
  const batchName = trim(exportProfile.batchName);
  const courseName = trim(exportProfile.courseName) || "门店创意饮品策划与运营实践";
  const certificationSummary = (Array.isArray(scoreSummary.certifications) ? scoreSummary.certifications : [])
    .map((item) => trim(item?.roleName) ? `${trim(item.roleName)}${trim(item.result) ? `（${trim(item.result)}）` : ""}` : "")
    .filter(Boolean)
    .join("、");

  const creativeDrinksHtml = normalizedWeek.creative.drinks.map((drink, index) => renderDrinkSummary(drink, index)).join("");
  const inheritedDrinksHtml = (normalizedWeek.handover.inheritedDrinks || []).map((drink, index) => renderDrinkSummary(drink, index)).join("");

  let dailyHtml = "";
  dates.forEach((date, index) => {
    ensureDayOnWeek(normalizedWeek, date);
    const day = normalizedWeek.daily[date];
    const processHtml = PROCESS_ITEM_DEFINITIONS.map((item) => `
      <div class="sub-card">
        <h4>${escapeHtml(item.key)} ${escapeHtml(item.title)}</h4>
        <p><b>标准提示：</b>${formatRichText(item.guidance)}</p>
        <p><b>执行说明：</b>${formatRichText(day.processes[item.key].execution)}</p>
        ${renderReportGallery(day.processes[item.key].images, "daily", `未上传${item.shortTitle}图片，已使用 AI 场景示意。`)}
        <div class="approval">经理确认：${escapeHtml(renderApprovalText(day.processes[item.key].approval))}</div>
      </div>
    `).join("");
    dailyHtml += `
      <section class="day-card">
        <div class="day-head">
          <div>
            <div class="eyebrow">Daily Practice</div>
            <h3>${escapeHtml(date)} ${index === 7 ? "次周三交接日" : "实训执行日"}</h3>
          </div>
          <span class="chip">${index === 7 ? "交接收尾" : "执行记录"}</span>
        </div>
        <div class="metric-row">
          <div class="metric-box"><span>签到</span><strong>${escapeHtml(day.checkIn || "-")}</strong><em>${escapeHtml(renderApprovalText(day.approvals.checkIn))}</em></div>
          <div class="metric-box"><span>签退</span><strong>${escapeHtml(day.checkOut || "-")}</strong><em>${escapeHtml(renderApprovalText(day.approvals.checkOut))}</em></div>
          <div class="metric-box"><span>经营统计</span><strong>营业额 ${escapeHtml(day.sales || "0")} / 成本 ${escapeHtml(day.cost || "0")} / 损耗 ${escapeHtml(day.lossAmount || "0")}</strong><em>当日经营数据</em></div>
        </div>
        <div class="sub-card">
          <h4>出勤与异常说明</h4>
          <p>${formatRichText(day.attendanceNote)}</p>
          <p><b>异常补充：</b>${formatRichText(day.exceptionNote)}</p>
        </div>
        <div class="sub-card">
          <h4>仪容仪表检查</h4>
          ${renderReportGallery(day.grooming, "daily", "未上传仪容仪表照片，已用 AI 检查场景图示意。")}
          <div class="approval">经理确认：${escapeHtml(renderApprovalText(day.approvals.grooming))}</div>
        </div>
        ${processHtml}
        <div class="sub-card">
          <h4>签收记录</h4>
          <p>${formatRichText(day.receiptDesc)}</p>
          ${renderReportGallery(day.receiptImgs, "handover", "未上传签收照片，已用 AI 交接签收图示意。")}
          <div class="approval">经理确认：${escapeHtml(renderApprovalText(day.approvals.receipt))}</div>
        </div>
        <div class="sub-card">
          <h4>23 每日工作报表</h4>
          <p><b>工作概述：</b>${formatRichText(day.dailyReport.summary)}</p>
          <p><b>当日亮点：</b>${formatRichText(day.dailyReport.highlights)}</p>
          <p><b>问题与异常：</b>${formatRichText(day.dailyReport.issues)}</p>
          <p><b>次日跟进：</b>${formatRichText(day.dailyReport.followUp)}</p>
        </div>
      </section>
    `;
  });

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>实践周实训手册</title>
  <style>
    body { margin: 0; padding: 0; background: #f5efe5; color: #2b241d; font-family: "Microsoft YaHei", "微软雅黑", sans-serif; line-height: 1.7; }
    .report { max-width: 980px; margin: 0 auto; padding: 24px; }
    .cover { background: #fffaf2; border: 1px solid #d5c2a3; border-radius: 28px; overflow: hidden; box-shadow: 0 10px 26px rgba(69, 45, 22, .08); }
    .cover img { display: block; width: 100%; height: auto; }
    .cover-body { padding: 28px 32px 34px; background: linear-gradient(180deg, #fffaf2 0%, #f7efe2 100%); }
    .eyebrow { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #8b6a40; margin-bottom: 6px; }
    h1, h2, h3, h4, p { margin-top: 0; }
    h1 { margin-bottom: 8px; font-size: 34px; color: #4f2d17; }
    h2 { margin-bottom: 12px; font-size: 24px; color: #6a3a12; }
    h3 { margin-bottom: 10px; font-size: 20px; color: #3f3023; }
    h4 { margin-bottom: 8px; font-size: 16px; color: #5b3c18; }
    .lead { color: #6d5b49; font-size: 15px; }
    .meta-wrap { margin-top: 18px; }
    .meta-card { display: inline-block; width: 47.6%; vertical-align: top; margin: 0 1.2% 12px 0; padding: 16px 18px; border-radius: 18px; background: #fff; border: 1px solid #e0cfb4; }
    .meta-card:nth-child(2n) { margin-right: 0; }
    .meta-card span { display: block; font-size: 12px; color: #8e785d; margin-bottom: 6px; }
    .meta-card strong { font-size: 18px; color: #4d3015; }
    .section { margin-top: 22px; padding: 22px 24px; border-radius: 24px; background: #fffdf9; border: 1px solid #ddcfba; box-shadow: 0 8px 22px rgba(83, 59, 33, .05); }
    .section-banner { width: 100%; border-radius: 18px; border: 1px solid #dcc8a7; margin-bottom: 16px; }
    .summary-box { padding: 16px 18px; border-radius: 16px; background: #f8f2e9; border-left: 5px solid #b67930; margin-bottom: 14px; }
    .summary-box p:last-child, .sub-card p:last-child { margin-bottom: 0; }
    .chip { display: inline-block; padding: 4px 12px; border-radius: 999px; background: #efe0c8; color: #694116; font-size: 12px; }
    .approval { display: inline-block; margin-top: 8px; padding: 8px 12px; border-radius: 12px; background: #eef6f3; color: #205b53; border: 1px solid #b9d8cf; font-size: 13px; }
    .gallery { margin-top: 10px; }
    .gallery-image { width: 31%; min-width: 150px; max-width: 220px; height: 150px; object-fit: cover; border-radius: 14px; border: 1px solid #d5c3aa; margin: 0 10px 10px 0; background: #faf8f4; }
    .gallery-image.large { width: 47%; max-width: 320px; height: 190px; }
    .empty-gallery { margin-top: 10px; padding: 14px; border-radius: 16px; background: #fbf6ef; border: 1px dashed #c9af88; text-align: center; }
    .empty-art { width: 100%; max-width: 340px; border-radius: 14px; border: 1px solid #e1d1b8; }
    .empty-copy { margin-top: 8px; color: #7a6854; font-size: 13px; }
    .day-card { margin-bottom: 18px; padding: 18px; border-radius: 20px; background: #fff; border: 1px solid #e2d4bf; }
    .day-head { margin-bottom: 14px; }
    .day-head .chip { float: right; margin-top: 4px; }
    .metric-row { margin-bottom: 12px; }
    .metric-box { display: inline-block; width: 31%; vertical-align: top; margin-right: 2%; padding: 12px 14px; border-radius: 16px; background: #f6f7f3; border: 1px solid #d7ddcf; min-height: 96px; }
    .metric-box:last-child { margin-right: 0; }
    .metric-box span, .metric-box em { display: block; }
    .metric-box span { font-size: 12px; color: #6f7767; margin-bottom: 6px; }
    .metric-box strong { display: block; font-size: 18px; color: #2f4130; margin-bottom: 6px; }
    .metric-box em { font-style: normal; color: #65716a; font-size: 12px; }
    .sub-card { margin-top: 12px; padding: 14px 16px; border-radius: 16px; background: #fffaf4; border: 1px solid #eadbc7; }
    .gallery-pair { margin-top: 10px; }
    .gallery-pair h5 { margin: 0 0 8px; font-size: 14px; color: #6d5b49; }
    .report-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    .report-table th, .report-table td { border: 1px solid #e1d1b8; padding: 8px 10px; text-align: left; vertical-align: top; }
    .report-table th { background: #f8f1e7; color: #5f4627; }
    .footer-note { margin-top: 24px; color: #7f715f; font-size: 12px; text-align: right; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="report">
    <section class="cover">
      <img src="${coverImage}" alt="AI封面视觉" />
      <div class="cover-body">
        <div class="eyebrow">实训归档</div>
        <h1>实践周实训手册</h1>
        <p class="lead">用于记录个人在本轮实训中的准备、执行、交接、总结、评分与认证结果。</p>
        <div class="meta-wrap">
          <div class="meta-card"><span>学员姓名</span><strong>${escapeHtml(studentName || "未记录")}</strong></div>
          <div class="meta-card"><span>学号</span><strong>${escapeHtml(studentUsername || "未记录")}</strong></div>
          <div class="meta-card"><span>班级</span><strong>${escapeHtml(className || "未关联")}</strong></div>
          <div class="meta-card"><span>课程批次</span><strong>${escapeHtml(batchName || "未关联")}</strong></div>
          <div class="meta-card"><span>教学周次</span><strong>${escapeHtml(teachingWeekText)}</strong></div>
          <div class="meta-card"><span>轮值周期</span><strong>${escapeHtml(normalizedWeek.startDate)} 至 ${escapeHtml(normalizedWeek.endDate)}</strong></div>
          <div class="meta-card"><span>课程名称</span><strong>${escapeHtml(courseName)}</strong></div>
          <div class="meta-card"><span>下一组交接人</span><strong>${escapeHtml(normalizedWeek.nextGroup || "待补充")}</strong></div>
        </div>
        <div class="summary-box">
          <p><b>课程总评分：</b>${renderScoreValue(scoreSummary.courseFinalScore)}</p>
          <p><b>展示赛均分：</b>${renderScoreValue(scoreSummary.showcaseAverageScore)}</p>
          <p><b>岗位认证：</b>${formatRichText(certificationSummary)}</p>
          <p><b>本组成员：</b>${escapeHtml(reportOwners)}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <img src="${reportArt("creative", "准备期提交", "问卷调研、两款创意饮品、物料与海报")}" class="section-banner" alt="AI创意策划插图" />
      <h2>一、准备期提交</h2>
      <div class="summary-box">
        <p><b>问卷设计：</b>${formatRichText(normalizedWeek.creative.survey.questions)}</p>
        <p><b>样本量：</b>${formatRichText(normalizedWeek.creative.survey.sampleSize)}</p>
        <p><b>结果摘要：</b>${formatRichText(normalizedWeek.creative.survey.resultSummary)}</p>
        <p><b>分析结论：</b>${formatRichText(normalizedWeek.creative.survey.analysis)}</p>
      </div>
      <h4>调研截图</h4>
      ${renderReportGallery(normalizedWeek.creative.survey.resultImages, "creative", "未上传调研截图，已使用 AI 调研视觉示意。")}
      ${creativeDrinksHtml}
      <div class="sub-card">
        <h4>特殊物料清单</h4>
        ${renderProcurementTable(normalizedWeek.creative.procurementItems)}
      </div>
      <h4>创意海报展示</h4>
      ${renderReportGallery(normalizedWeek.creative.posters, "creative", "本周未上传创意海报，已使用 AI 新品海报视觉示意。", true)}
      <div class="approval">经理确认：${escapeHtml(renderApprovalText(normalizedWeek.creative.approval))}</div>
    </section>

    <section class="section page-break">
      <img src="${reportArt("daily", "13-23 项过程管理", "按日沉淀门店运营过程、经营数据与工作报表")}" class="section-banner" alt="AI每日运营插图" />
      <h2>二、13-23 项过程管理</h2>
      ${dailyHtml}
    </section>

    <section class="section page-break">
      <img src="${reportArt("handover", "交接传承", "上一组配方继承、交接说明与确认留痕")}" class="section-banner" alt="AI交接班插图" />
      <h2>三、交接传承</h2>
      <div class="sub-card">
        <h4>上一组可继承内容</h4>
        <p><b>来源批次：</b>${formatRichText(normalizedWeek.handover.inheritedFrom?.batchName)}</p>
        <p><b>来源小组：</b>${formatRichText(normalizedWeek.handover.inheritedFrom?.groupName)}</p>
        <p><b>来源周次：</b>${formatRichText(normalizedWeek.handover.inheritedFrom?.weekStartDate)}</p>
        <p><b>来源组员：</b>${formatRichText(normalizedWeek.handover.inheritedFrom?.studentName)}</p>
      </div>
      ${inheritedDrinksHtml || `<div class="sub-card"><p>未找到上一组可继承的创意饮品数据。</p></div>`}
      <div class="summary-box">
        <p><b>交接说明：</b>${formatRichText(normalizedWeek.handover.summary)}</p>
        <p><b>交接对象：</b>${formatRichText(normalizedWeek.handover.nextGroup || normalizedWeek.nextGroup)}</p>
      </div>
      ${renderReportGallery(normalizedWeek.handover.photos, "handover", "未上传交接现场照片，已使用 AI 交接场景图示意。", true)}
      <div class="approval">交接确认：${escapeHtml(normalizedWeek.handover.confirmation?.status || "待确认")} ${escapeHtml(normalizedWeek.handover.confirmation?.by || "")} ${escapeHtml(normalizedWeek.handover.confirmation?.time || "")}</div>
      <div class="approval">经理确认：${escapeHtml(renderApprovalText(normalizedWeek.handover.approval))}</div>
    </section>

    <section class="section">
      <img src="${reportArt("reflection", "总结与反思", "沉淀个人成长、门店优化方案与运营经理评语")}" class="section-banner" alt="AI总结反思插图" />
      <h2>四、总结与反思</h2>
      <div class="sub-card">
        <h4>学员A自评与收获</h4>
        <p>${formatRichText(normalizedWeek.reflection.a)}</p>
      </div>
      <div class="sub-card">
        <h4>学员B自评与收获</h4>
        <p>${formatRichText(normalizedWeek.reflection.b)}</p>
      </div>
      <div class="sub-card">
        <h4>门店运营优化与建议方案</h4>
        <p>${formatRichText(normalizedWeek.reflection.optPlan)}</p>
      </div>
      <div class="sub-card">
        <h4>运营经理结语</h4>
        <p>${formatRichText(normalizedWeek.reflection.managerComment)}</p>
      </div>
      <div class="approval">最终确认：${escapeHtml(renderApprovalText(normalizedWeek.reflection.approval))}</div>
    </section>

    <p class="footer-note">导出时间：${escapeHtml(new Date().toLocaleString())}</p>
  </div>
</body>
</html>`;
}

export function exportReportWord(week, scopeUser, html) {
  const blob = new Blob([html], { type: "application/msword" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `个人实训手册_${scopeUser}_${week.startDate}_to_${week.endDate}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function openReportPreview(html) {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) return false;
  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
  return true;
}
