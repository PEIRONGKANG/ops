import { ensureDayOnWeek, escapeHtml, getWeekDates, renderApprovalText, trim } from "./reportHelpers";

const DAY_LABELS = ["周三", "周四", "周五", "周六", "周日", "周一", "周二", "次周三"];

function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s{2,}/g, " ").trim())}`;
}

function buildArt(kind, title = "", subtitle = "") {
  const main = escapeHtml(title);
  const sub = escapeHtml(subtitle);
  const themes = {
    cover: { a: "#6e4a20", b: "#d8a246", c: "#2d8b84", d: "#f7f0e5" },
    creative: { a: "#8d4e10", b: "#f1ca76", c: "#df7a42", d: "#fff7ec" },
    daily: { a: "#245f82", b: "#8ac7d8", c: "#59a396", d: "#edf8fb" },
    handover: { a: "#6c4f7d", b: "#d2c4ef", c: "#8f7bd9", d: "#f7f2ff" },
    reflection: { a: "#4d6a32", b: "#d0e4a2", c: "#8dab53", d: "#f6faee" },
    gallery: { a: "#6d5034", b: "#e2ccb0", c: "#b78b56", d: "#fbf7f0" },
  };
  const theme = themes[kind] || themes.gallery;

  const iconMap = {
    cover: `
      <rect x="92" y="70" width="140" height="142" rx="28" fill="rgba(255,255,255,.86)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M126 136c0-23 18-41 41-41h3c23 0 41 18 41 41v28h-85z" fill="${theme.a}"/>
      <path d="M140 126c0-13 10-23 23-23h15c13 0 23 10 23 23v10h-61z" fill="${theme.c}"/>
      <path d="M235 126c18 0 31 14 31 30s-13 30-31 30" fill="none" stroke="${theme.a}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="794" cy="90" r="46" fill="${theme.b}" opacity=".9"/>
      <path d="M716 172c20-42 61-70 108-70 18 0 36 4 51 13-10 45-51 79-100 79-22 0-42-8-59-22z" fill="${theme.c}" opacity=".9"/>
    `,
    creative: `
      <circle cx="140" cy="114" r="56" fill="rgba(255,255,255,.8)"/>
      <path d="M110 140c24-34 46-50 69-56-7 20-17 36-33 51 11 2 20 8 28 17-25 0-46-4-64-12z" fill="${theme.a}" opacity=".9"/>
      <rect x="396" y="56" width="146" height="116" rx="24" fill="rgba(255,255,255,.9)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M428 118c10-19 26-30 46-30 22 0 38 11 49 30l10 26c6 16-6 30-24 30h-67c-17 0-29-16-23-31z" fill="${theme.c}"/>
      <path d="M452 96c6 5 10 12 11 20 8-7 18-10 29-10-5 5-9 11-10 17 8 1 17 5 24 11-11 1-20 5-29 12-5-8-13-15-25-20z" fill="${theme.b}" opacity=".9"/>
    `,
    daily: `
      <circle cx="146" cy="114" r="58" fill="rgba(255,255,255,.8)"/>
      <path d="M116 145h62c10 0 17-9 14-18l-8-34c-4-18-20-31-39-31-19 0-35 13-39 31l-6 22c-3 16 9 30 24 30z" fill="${theme.c}"/>
      <path d="M111 168h92" stroke="${theme.a}" stroke-width="10" stroke-linecap="round"/>
      <rect x="396" y="54" width="144" height="120" rx="22" fill="rgba(255,255,255,.9)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M432 90h67M432 120h48M432 150h58" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M414 91l8 9 16-19M414 121l8 9 16-19" fill="none" stroke="${theme.c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    handover: `
      <rect x="86" y="56" width="146" height="126" rx="20" fill="rgba(255,255,255,.9)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M118 94h82M118 124h82M118 154h56" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M282 118h122" stroke="${theme.c}" stroke-width="12" stroke-linecap="round"/>
      <path d="M384 90l42 28-42 28" fill="none" stroke="${theme.c}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="432" y="74" width="92" height="92" rx="22" fill="rgba(255,255,255,.86)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M456 96h28M456 118h44M456 140h44" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
    `,
    reflection: `
      <circle cx="146" cy="114" r="58" fill="rgba(255,255,255,.82)"/>
      <path d="M130 80h34v34c0 11-8 19-17 19s-17-8-17-19z" fill="${theme.a}"/>
      <path d="M118 82h12v20c0 8-5 15-12 15M176 82h-12v20c0 8 5 15 12 15" fill="none" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M128 146h38M116 166h62" stroke="${theme.c}" stroke-width="10" stroke-linecap="round"/>
      <rect x="398" y="58" width="140" height="114" rx="20" fill="rgba(255,255,255,.88)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M428 94h80M428 124h80M428 154h60" stroke="${theme.c}" stroke-width="8" stroke-linecap="round"/>
    `,
    gallery: `
      <rect x="92" y="62" width="144" height="116" rx="18" fill="rgba(255,255,255,.84)" stroke="${theme.a}" stroke-width="4"/>
      <circle cx="142" cy="100" r="16" fill="${theme.b}"/>
      <path d="M110 156l28-30 26 20 17-14 41 24" fill="none" stroke="${theme.c}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="380" y="76" width="152" height="84" rx="20" fill="rgba(255,255,255,.78)" stroke="${theme.a}" stroke-dasharray="10 8" stroke-width="4"/>
      <path d="M422 118h68" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
    `,
  };

  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="320" viewBox="0 0 960 320">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.d}"/>
          <stop offset="58%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="${theme.b}"/>
        </linearGradient>
      </defs>
      <rect width="960" height="320" rx="34" fill="url(#bg)"/>
      <circle cx="826" cy="62" r="96" fill="${theme.b}" opacity=".2"/>
      <circle cx="108" cy="266" r="86" fill="${theme.c}" opacity=".16"/>
      <rect x="28" y="26" width="904" height="268" rx="28" fill="none" stroke="${theme.a}" stroke-opacity=".18" stroke-width="2"/>
      ${iconMap[kind] || iconMap.gallery}
      <text x="306" y="122" font-size="38" font-family="Microsoft YaHei, sans-serif" font-weight="700" fill="${theme.a}">${main}</text>
      <text x="306" y="172" font-size="20" font-family="Microsoft YaHei, sans-serif" fill="#5d5142">${sub}</text>
      <text x="306" y="214" font-size="14" font-family="Microsoft YaHei, sans-serif" fill="#8a765f">Drink Training Weekly Portfolio</text>
    </svg>
  `);
}

function formatRichText(value, fallback = "未填写") {
  const safe = escapeHtml(value);
  return safe ? safe.replace(/\n/g, "<br/>") : fallback;
}

function renderGallery(images, emptyKind, emptyText, large = false) {
  if (images && images.length) {
    return `<div class="gallery">${images
      .map((src) => `<img src="${src}" class="${large ? "gallery-image large" : "gallery-image"}" alt="报告图片" />`)
      .join("")}</div>`;
  }

  return `
    <div class="empty-gallery">
      <img src="${buildArt(emptyKind, "AI 视觉补位", emptyText)}" class="empty-art" alt="AI补位图" />
      <div class="empty-copy">${escapeHtml(emptyText)}</div>
    </div>
  `;
}

export function buildReportHtml({ week, group, scopeUser }) {
  const dates = getWeekDates(week.startDate);
  const teachingWeekText = trim(group?.teachingWeek) || trim(week.teachingWeek) || "未设置";
  const studentNames = [week.members.a, week.members.b].map(trim).filter(Boolean);
  const reportOwners = studentNames.length ? studentNames.join("、") : trim(scopeUser) || "待确认";
  const coverImage = buildArt("cover", "饮品实训周工作报告", "门店饮品设计与运营实践课程成果留痕");

  const dailyHtml = dates
    .map((date, index) => {
      const day = ensureDayOnWeek(week, date);
      const financeSummary = `营业额 ${escapeHtml(day.sales || "0")} 元 / 成本 ${escapeHtml(day.cost || "0")} 元 / 损耗 ${escapeHtml(day.lossAmount || "0")} 元`;
      return `
        <section class="day-card">
          <div class="day-head">
            <div>
              <div class="eyebrow">Daily Operations</div>
              <h3>${escapeHtml(date)} ${DAY_LABELS[index]}</h3>
            </div>
            <span class="chip">${index === 7 ? "交接收尾" : "执行记录"}</span>
          </div>
          <div class="metric-row">
            <div class="metric-box"><span>签到</span><strong>${escapeHtml(day.checkIn || "-")}</strong><em>${escapeHtml(renderApprovalText(day.approvals.checkIn))}</em></div>
            <div class="metric-box"><span>签退</span><strong>${escapeHtml(day.checkOut || "-")}</strong><em>${escapeHtml(renderApprovalText(day.approvals.checkOut))}</em></div>
            <div class="metric-box"><span>财务摘要</span><strong>${financeSummary}</strong><em>运营数据留痕</em></div>
          </div>
          <div class="sub-card">
            <h4>出勤说明</h4>
            <p>${formatRichText(day.attendanceNote)}</p>
          </div>
          <div class="sub-card">
            <h4>仪容仪表检查</h4>
            ${renderGallery(day.grooming, "daily", "未上传仪容仪表照片，已使用 AI 检查场景图示意。")}
          </div>
          <div class="sub-card">
            <h4>上班前卫生（公区/吧台）</h4>
            ${renderGallery([...day.openingPublic, ...day.openingBar], "daily", "未上传开档卫生图片，已使用 AI 运营场景图示意。")}
          </div>
          <div class="sub-card">
            <h4>下班后卫生（公区/吧台）</h4>
            ${renderGallery([...day.closingPublic, ...day.closingBar], "daily", "未上传闭店卫生图片，已使用 AI 运营场景图示意。")}
          </div>
          <div class="sub-card">
            <h4>损耗与库存</h4>
            <p><b>损耗说明：</b>${formatRichText(day.lossDesc)}</p>
            <p><b>库存说明：</b>${formatRichText(day.inventoryDesc)}</p>
            ${renderGallery([...day.lossImgs, ...day.inventoryImgs], "gallery", "未上传损耗或库存图片，已使用 AI 物料陈列图示意。")}
          </div>
          <div class="sub-card">
            <h4>签收记录</h4>
            <p>${formatRichText(day.receiptDesc)}</p>
            ${renderGallery(day.receiptImgs, "handover", "未上传签收照片，已使用 AI 交接签收图示意。")}
          </div>
          <div class="sub-card">
            <h4>当日补充说明</h4>
            <p>${formatRichText(day.notes)}</p>
          </div>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>饮品实训周工作报告</title>
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
    .day-head { margin-bottom: 14px; overflow: hidden; }
    .day-head .chip { float: right; margin-top: 4px; }
    .metric-row { margin-bottom: 12px; }
    .metric-box { display: inline-block; width: 31%; vertical-align: top; margin-right: 2%; padding: 12px 14px; border-radius: 16px; background: #f6f7f3; border: 1px solid #d7ddcf; min-height: 96px; }
    .metric-box:last-child { margin-right: 0; }
    .metric-box span, .metric-box em { display: block; }
    .metric-box span { font-size: 12px; color: #6f7767; margin-bottom: 6px; }
    .metric-box strong { display: block; font-size: 18px; color: #2f4130; margin-bottom: 6px; }
    .metric-box em { font-style: normal; color: #65716a; font-size: 12px; }
    .sub-card { margin-top: 12px; padding: 14px 16px; border-radius: 16px; background: #fffaf4; border: 1px solid #eadbc7; }
    .footer-note { margin-top: 24px; color: #7f715f; font-size: 12px; text-align: right; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="report">
    <section class="cover">
      <img src="${coverImage}" alt="AI封面视觉" />
      <div class="cover-body">
        <div class="eyebrow">Practical Training Weekly Portfolio</div>
        <h1>饮品实训周工作报告</h1>
        <p class="lead">围绕门店饮品设计与运营实践课程，对创意策划、每日执行、交接管理与复盘成长进行一体化留痕，形成可归档、可展示、可复盘的周度成果文档。</p>
        <div class="meta-wrap">
          <div class="meta-card"><span>教学周次</span><strong>${escapeHtml(teachingWeekText)}</strong></div>
          <div class="meta-card"><span>轮值周次</span><strong>${escapeHtml(week.startDate)} 至 ${escapeHtml(week.endDate)}</strong></div>
          <div class="meta-card"><span>本组成员</span><strong>${escapeHtml(reportOwners)}</strong></div>
          <div class="meta-card"><span>下一组交接人</span><strong>${escapeHtml(week.nextGroup || "待补充")}</strong></div>
        </div>
      </div>
    </section>

    <section class="section">
      <img src="${buildArt("creative", "创意饮品策划提交", "从市场洞察到海报表达，沉淀周三新品策划成果")}" class="section-banner" alt="AI创意策划插图" />
      <h2>一、周三创意饮品策划</h2>
      <div class="summary-box">
        <p><b>营销计划：</b>${formatRichText(week.creative.marketing)}</p>
        <p><b>饮品配方与制作方法：</b>${formatRichText(week.creative.recipe)}</p>
        <p><b>特殊物料采购计划：</b>${formatRichText(week.creative.procurement)}</p>
      </div>
      <h4>创意海报展示</h4>
      ${renderGallery(week.creative.posters, "creative", "本周未上传创意海报，已使用 AI 新品海报视觉示意。", true)}
      <div class="approval">经理确认：${escapeHtml(renderApprovalText(week.creative.approval))}</div>
    </section>

    <section class="section page-break">
      <img src="${buildArt("daily", "每日打卡与运营执行", "按日沉淀运营动作、卫生留痕、财务记录与签收情况")}" class="section-banner" alt="AI每日运营插图" />
      <h2>二、每日打卡与运营执行</h2>
      ${dailyHtml}
    </section>

    <section class="section page-break">
      <img src="${buildArt("handover", "交接班记录", "将经验、问题与改进建议顺畅移交给下一组")}" class="section-banner" alt="AI交接班插图" />
      <h2>三、交接班记录</h2>
      <div class="summary-box">
        <p><b>交接说明：</b>${formatRichText(week.handover.summary)}</p>
        <p><b>交接对象：</b>${formatRichText(week.handover.nextGroup || week.nextGroup)}</p>
      </div>
      ${renderGallery(week.handover.photos, "handover", "未上传交接现场照片，已使用 AI 交接场景图示意。", true)}
      <div class="approval">经理确认：${escapeHtml(renderApprovalText(week.handover.approval))}</div>
    </section>

    <section class="section">
      <img src="${buildArt("reflection", "总结与反思", "沉淀个人成长、门店优化方案与运营经理评语")}" class="section-banner" alt="AI总结反思插图" />
      <h2>四、总结与反思</h2>
      <div class="sub-card">
        <h4>学员 A 自评与收获</h4>
        <p>${formatRichText(week.reflection.a)}</p>
      </div>
      <div class="sub-card">
        <h4>学员 B 自评与收获</h4>
        <p>${formatRichText(week.reflection.b)}</p>
      </div>
      <div class="sub-card">
        <h4>门店运营优化与建议方案</h4>
        <p>${formatRichText(week.reflection.optPlan)}</p>
      </div>
      <div class="sub-card">
        <h4>运营经理结语</h4>
        <p>${formatRichText(week.reflection.managerComment)}</p>
      </div>
      <div class="approval">最终确认：${escapeHtml(renderApprovalText(week.reflection.approval))}</div>
    </section>

    <p class="footer-note">导出时间：${escapeHtml(new Date().toLocaleString())}</p>
  </div>
</body>
</html>`;
}

export function openReportPreview(html) {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) return false;
  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
  return true;
}

export function exportReportWord(week, scopeUser, html) {
  const blob = new Blob([html], { type: "application/msword" });
  const fileName = `实训周工作报告_${scopeUser}_${week.startDate}_to_${week.endDate}.doc`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
