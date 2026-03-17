import { ensureDayOnWeek, escapeHtml, getWeekDates, renderApprovalText, trim } from "./reportHelpers";

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
      <rect x="118" y="74" rx="30" ry="30" width="132" height="130" fill="rgba(255,255,255,.88)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M145 118c6-16 20-27 39-27h4c18 0 32 11 38 27l12 40c4 15-7 30-22 30h-62c-16 0-27-15-22-30z" fill="${theme.a}"/>
      <path d="M164 116c0-11 9-19 19-19h30c11 0 20 8 20 19v12h-69z" fill="${theme.c}"/>
      <path d="M248 120c18 0 32 13 32 30 0 17-14 30-32 30" fill="none" stroke="${theme.a}" stroke-width="10" stroke-linecap="round"/>
    `,
    creative: `
      <circle cx="148" cy="112" r="52" fill="rgba(255,255,255,.75)"/>
      <path d="M120 136c23-33 44-50 68-55-6 18-16 34-32 49 10 2 18 8 26 16-24 0-44-4-62-10z" fill="${theme.a}" opacity=".88"/>
      <rect x="176" y="84" width="86" height="74" rx="20" fill="rgba(255,255,255,.88)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M193 118c7-14 18-22 33-22 16 0 28 8 35 22l7 18c5 13-5 23-18 23h-49c-14 0-22-12-17-24z" fill="${theme.c}"/>
      <path d="M209 102c4 4 7 10 8 15 6-5 13-8 22-7-4 4-7 8-8 13 7 1 13 4 19 9-9 1-16 4-22 10-4-8-10-13-19-18z" fill="${theme.b}" opacity=".92"/>
    `,
    daily: `
      <circle cx="154" cy="112" r="54" fill="rgba(255,255,255,.78)"/>
      <path d="M124 142h61c9 0 15-8 13-16l-8-34c-4-18-19-31-38-31s-34 13-38 31l-5 22c-3 15 8 28 23 28z" fill="${theme.c}"/>
      <path d="M117 162h89" stroke="${theme.a}" stroke-width="10" stroke-linecap="round"/>
      <rect x="176" y="78" width="92" height="82" rx="18" fill="rgba(255,255,255,.84)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M199 106h44M199 130h44M199 154h30" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M184 108l8 9 14-18" fill="none" stroke="${theme.c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    handover: `
      <rect x="88" y="56" width="138" height="124" rx="18" fill="rgba(255,255,255,.88)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M118 92h79M118 120h79M118 148h54" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M238 118h40" stroke="${theme.c}" stroke-width="10" stroke-linecap="round"/>
      <path d="M266 98l26 20-26 20" fill="none" stroke="${theme.c}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    reflection: `
      <circle cx="148" cy="112" r="56" fill="rgba(255,255,255,.82)"/>
      <path d="M132 78h32v31c0 10-7 18-16 18s-16-8-16-18z" fill="${theme.a}"/>
      <path d="M120 80h12v18c0 8-5 14-12 14M176 80h-12v18c0 8 5 14 12 14" fill="none" stroke="${theme.a}" stroke-width="8" stroke-linecap="round"/>
      <path d="M130 142h36M120 162h56" stroke="${theme.c}" stroke-width="10" stroke-linecap="round"/>
      <rect x="186" y="82" width="82" height="68" rx="18" fill="rgba(255,255,255,.86)" stroke="${theme.a}" stroke-width="4"/>
      <path d="M206 106h40M206 128h40M206 150h28" stroke="${theme.c}" stroke-width="8" stroke-linecap="round"/>
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
      <circle cx="820" cy="54" r="92" fill="${theme.b}" opacity=".16"/>
      <circle cx="104" cy="264" r="84" fill="${theme.c}" opacity=".12"/>
      <rect x="28" y="26" width="904" height="268" rx="28" fill="none" stroke="${theme.a}" stroke-opacity=".18" stroke-width="2"/>
      ${iconMap[kind] || iconMap.gallery}
      <rect x="292" y="74" width="394" height="156" rx="20" fill="rgba(255,255,255,.72)"/>
      <text x="304" y="118" font-size="38" font-family="Microsoft YaHei, sans-serif" font-weight="700" fill="${theme.a}">${main}</text>
      <text x="304" y="168" font-size="20" font-family="Microsoft YaHei, sans-serif" fill="#5d5142">${sub}</text>
      <text x="304" y="214" font-size="14" font-family="Microsoft YaHei, sans-serif" fill="#8a765f">Drink Training Report Visual</text>
    </svg>
  `);
}

function renderReportGallery(images, emptyKind, emptyText, large = false) {
  if (images && images.length) {
    return `<div class="gallery">${images.map((src) => `<img src="${src}" class="${large ? "gallery-image large" : "gallery-image"}" />`).join("")}</div>`;
  }
  return `<div class="empty-gallery"><img src="${reportArt(emptyKind, "AI视觉补位", emptyText)}" class="empty-art" /><div class="empty-copy">${escapeHtml(emptyText)}</div></div>`;
}

export function buildReportHtml({ week, group, scopeUser }) {
  const dates = getWeekDates(week.startDate);
  const teachingWeekText = trim(group?.teachingWeek) || "未设置";
  const studentNames = [week.members.a, week.members.b].map(trim).filter(Boolean);
  const reportOwners = studentNames.length ? studentNames.join("、") : escapeHtml(scopeUser || "本周学员");
  const coverImage = reportArt("cover", "饮品实训周工作报告", "门店饮品设计与运营实践课程成果留痕");

  let dailyHtml = "";
  dates.forEach((date, index) => {
    ensureDayOnWeek(week, date);
    const day = week.daily[date];
    const financeSummary = `营业额 ${escapeHtml(day.sales || "0")} 元 / 成本 ${escapeHtml(day.cost || "0")} 元 / 损耗 ${escapeHtml(day.lossAmount || "0")} 元`;
    dailyHtml += `
      <section class="day-card">
        <div class="day-head">
          <div>
            <div class="eyebrow">Daily Operations</div>
            <h3>${escapeHtml(date)} ${index === 7 ? "次周三交接日" : "日常运营日"}</h3>
          </div>
          <span class="chip">${index === 7 ? "交接收尾" : "执行记录"}</span>
        </div>
        <div class="metric-row">
          <div class="metric-box"><span>签到</span><strong>${escapeHtml(day.checkIn || "-")}</strong><em>${escapeHtml(renderApprovalText(day.approvals.checkIn))}</em></div>
          <div class="metric-box"><span>签退</span><strong>${escapeHtml(day.checkOut || "-")}</strong><em>${escapeHtml(renderApprovalText(day.approvals.checkOut))}</em></div>
          <div class="metric-box"><span>财务摘要</span><strong>${escapeHtml(financeSummary)}</strong><em>运营数据留痕</em></div>
        </div>
        <div class="sub-card">
          <h4>出勤说明</h4>
          <p>${formatRichText(day.attendanceNote)}</p>
        </div>
        <div class="sub-card">
          <h4>假条上传</h4>
          ${renderReportGallery(day.leaveImgs, "daily", "未上传假条图片。")}
        </div>
        <div class="sub-card">
          <h4>仪容仪表检查</h4>
          ${renderReportGallery(day.grooming, "daily", "未上传仪容仪表照片，已用 AI 检查场景图示意。")}
        </div>
        <div class="sub-card">
          <h4>上班前卫生（公区/吧台）</h4>
          ${renderReportGallery([...day.openingPublic, ...day.openingBar], "daily", "未上传开档卫生图片，已用 AI 营运场景图示意。")}
        </div>
        <div class="sub-card">
          <h4>下班后卫生（公区/吧台）</h4>
          ${renderReportGallery([...day.closingPublic, ...day.closingBar], "daily", "未上传闭店卫生图片，已用 AI 营运场景图示意。")}
        </div>
        <div class="sub-card">
          <h4>损耗与库存</h4>
          <p><b>损耗说明：</b>${formatRichText(day.lossDesc)}</p>
          <p><b>库存说明：</b>${formatRichText(day.inventoryDesc)}</p>
          ${renderReportGallery([...day.lossImgs, ...day.inventoryImgs], "gallery", "未上传损耗或库存图片，已用 AI 物料陈列图示意。")}
        </div>
        <div class="sub-card">
          <h4>签收记录</h4>
          <p>${formatRichText(day.receiptDesc)}</p>
          ${renderReportGallery(day.receiptImgs, "handover", "未上传签收照片，已用 AI 交接签收图示意。")}
        </div>
        <div class="sub-card">
          <h4>当日补充说明</h4>
          <p>${formatRichText(day.notes)}</p>
        </div>
      </section>
    `;
  });

  return `<!doctype html>
<html>
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
          <div class="meta-card"><span>轮值周期</span><strong>${escapeHtml(week.startDate)} 至 ${escapeHtml(week.endDate)}</strong></div>
          <div class="meta-card"><span>本组成员</span><strong>${escapeHtml(reportOwners)}</strong></div>
          <div class="meta-card"><span>下一组交接人</span><strong>${escapeHtml(week.nextGroup || "待补充")}</strong></div>
        </div>
      </div>
    </section>

    <section class="section">
      <img src="${reportArt("creative", "创意饮品策划提交", "从市场洞察到海报表达，沉淀周三新品策划成果")}" class="section-banner" alt="AI创意策划插图" />
      <h2>一、周三创意饮品策划提交</h2>
      <div class="summary-box">
        <p><b>行销计划：</b>${formatRichText(week.creative.marketing)}</p>
        <p><b>饮品配方与制作方法：</b>${formatRichText(week.creative.recipe)}</p>
        <p><b>特殊物料采购计划：</b>${formatRichText(week.creative.procurement)}</p>
      </div>
      <h4>创意海报展示</h4>
      ${renderReportGallery(week.creative.posters, "creative", "本周未上传创意海报，已使用 AI 新品海报视觉示意。", true)}
      <div class="approval">经理确认：${escapeHtml(renderApprovalText(week.creative.approval))}</div>
    </section>

    <section class="section page-break">
      <img src="${reportArt("daily", "每日打卡与运营执行", "按日沉淀营运动作、卫生留痕、财务记录与签收情况")}" class="section-banner" alt="AI每日运营插图" />
      <h2>二、每日打卡与运营执行</h2>
      ${dailyHtml}
    </section>

    <section class="section page-break">
      <img src="${reportArt("handover", "交接班记录", "将经验、问题与改进建议顺畅移交给下一组")}" class="section-banner" alt="AI交接班插图" />
      <h2>三、交接班记录</h2>
      <div class="summary-box">
        <p><b>交接说明：</b>${formatRichText(week.handover.summary)}</p>
        <p><b>交接对象：</b>${formatRichText(week.handover.nextGroup || week.nextGroup)}</p>
      </div>
      ${renderReportGallery(week.handover.photos, "handover", "未上传交接现场照片，已使用 AI 交接场景图示意。", true)}
      <div class="approval">经理确认：${escapeHtml(renderApprovalText(week.handover.approval))}</div>
    </section>

    <section class="section">
      <img src="${reportArt("reflection", "总结与反思", "沉淀个人成长、门店优化方案与运营经理评语")}" class="section-banner" alt="AI总结反思插图" />
      <h2>四、总结与反思</h2>
      <div class="sub-card">
        <h4>学员A自评与收获</h4>
        <p>${formatRichText(week.reflection.a)}</p>
      </div>
      <div class="sub-card">
        <h4>学员B自评与收获</h4>
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

export function exportReportWord(week, scopeUser, html) {
  const blob = new Blob([html], { type: "application/msword" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `实训周工作报告_${scopeUser}_${week.startDate}_to_${week.endDate}.doc`;
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
