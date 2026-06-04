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
    @page { size: A4; margin: 12mm 11mm 14mm; }
    * { box-sizing: border-box; }
    html { background: #eef2f7; }
    body {
      margin: 0;
      background: #eef2f7;
      color: #1f2937;
      font-family: "Microsoft YaHei", "微软雅黑", "Noto Sans SC", Arial, sans-serif;
      line-height: 1.62;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 12px;
      background: rgba(15, 23, 42, .86);
      backdrop-filter: blur(12px);
    }
    .print-toolbar button {
      border: 0;
      border-radius: 999px;
      padding: 10px 18px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: #fff;
      font-weight: 800;
      cursor: pointer;
    }
    .report {
      width: 210mm;
      margin: 0 auto;
      padding: 0;
      background: #f7fafc;
    }
    .sheet {
      min-height: 273mm;
      margin: 0 auto 14px;
      padding: 15mm 14mm;
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 18px 48px rgba(15, 23, 42, .12);
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }
    .sheet:last-child { page-break-after: auto; }
    .sheet::before {
      content: "";
      position: absolute;
      inset: 0 0 auto;
      height: 6px;
      background: linear-gradient(90deg, #2563eb, #7c3aed, #06b6d4, #22c55e);
    }
    .cover-sheet {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background:
        radial-gradient(circle at 12% 18%, rgba(37, 99, 235, .16), transparent 34mm),
        radial-gradient(circle at 88% 8%, rgba(124, 58, 237, .18), transparent 34mm),
        linear-gradient(145deg, #ffffff, #f8fbff 55%, #eef6ff);
    }
    .cover-hero {
      border: 1px solid #dbeafe;
      border-radius: 26px;
      overflow: hidden;
      background: rgba(255,255,255,.9);
      box-shadow: 0 16px 38px rgba(37, 99, 235, .12);
    }
    .cover-hero img { display: block; width: 100%; height: auto; }
    .cover-body { padding: 24px 26px 26px; }
    .school-line {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      padding: 7px 12px;
      text-transform: uppercase;
    }
    .eyebrow {
      margin: 0 0 7px;
      color: #64748b;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.8px;
      text-transform: uppercase;
    }
    h1, h2, h3, h4, p { margin-top: 0; }
    h1 {
      margin: 18px 0 10px;
      color: #0f172a;
      font-size: 34px;
      line-height: 1.18;
      letter-spacing: -.04em;
    }
    h2 {
      margin-bottom: 14px;
      color: #111827;
      font-size: 22px;
      line-height: 1.25;
    }
    h3 {
      margin-bottom: 9px;
      color: #1f2937;
      font-size: 17px;
    }
    h4 {
      margin-bottom: 7px;
      color: #334155;
      font-size: 14px;
    }
    .lead { color: #475569; font-size: 14px; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 18px;
    }
    .meta-card {
      padding: 13px 15px;
      border: 1px solid #dbeafe;
      border-radius: 16px;
      background: rgba(255,255,255,.86);
    }
    .meta-card span {
      display: block;
      margin-bottom: 4px;
      color: #64748b;
      font-size: 11px;
      font-weight: 800;
    }
    .meta-card strong {
      display: block;
      color: #0f172a;
      font-size: 15px;
      line-height: 1.45;
    }
    .report-index {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 20px;
    }
    .index-item {
      min-height: 86px;
      padding: 13px;
      border-radius: 18px;
      background: linear-gradient(145deg, #f8fafc, #eef6ff);
      border: 1px solid #e2e8f0;
    }
    .index-item b { display: block; color: #2563eb; font-size: 20px; }
    .index-item span { display: block; margin-top: 6px; color: #475569; font-size: 12px; font-weight: 700; }
    .section-head {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr);
      gap: 14px;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .section-art {
      width: 88px;
      height: 68px;
      object-fit: cover;
      border-radius: 16px;
      border: 1px solid #dbeafe;
      background: #f8fafc;
    }
    .section-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      height: 34px;
      margin-right: 8px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: #fff;
      font-size: 14px;
      font-weight: 900;
      vertical-align: middle;
    }
    .summary-box, .sub-card, .day-card {
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 8px 22px rgba(15, 23, 42, .04);
    }
    .summary-box {
      margin-bottom: 12px;
      padding: 15px 16px;
      border-left: 5px solid #2563eb;
      background: #f8fbff;
    }
    .summary-box p:last-child, .sub-card p:last-child { margin-bottom: 0; }
    .chip, .approval {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .chip {
      padding: 4px 10px;
      background: #eef2ff;
      color: #4338ca;
    }
    .approval {
      margin-top: 10px;
      padding: 8px 12px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #bbf7d0;
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-top: 8px;
    }
    .gallery-image {
      width: 100%;
      height: 34mm;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid #dbe3ef;
      background: #f8fafc;
    }
    .gallery-image.large { height: 48mm; }
    .empty-gallery {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      margin-top: 8px;
      padding: 11px;
      border-radius: 14px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
    }
    .empty-art {
      width: 112px;
      height: 76px;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .empty-copy { color: #64748b; font-size: 12px; }
    .day-card {
      margin-bottom: 12px;
      padding: 13px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .day-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      border-bottom: 1px solid #eef2f7;
      padding-bottom: 8px;
    }
    .metric-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1.45fr;
      gap: 8px;
      margin-bottom: 10px;
    }
    .metric-box {
      min-height: 76px;
      padding: 10px 11px;
      border-radius: 13px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .metric-box span, .metric-box em { display: block; }
    .metric-box span { margin-bottom: 4px; color: #64748b; font-size: 11px; font-weight: 800; }
    .metric-box strong { display: block; margin-bottom: 4px; color: #111827; font-size: 14px; line-height: 1.45; }
    .metric-box em { color: #64748b; font-size: 11px; font-style: normal; }
    .sub-card {
      margin-top: 9px;
      padding: 12px 13px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .two-column {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .footer-note {
      position: absolute;
      right: 14mm;
      bottom: 8mm;
      color: #94a3b8;
      font-size: 10px;
    }
    .page-break { page-break-before: always; }
    @media screen {
      .report { padding: 18px 0; }
    }
    @media print {
      html, body { background: #fff; }
      .print-toolbar { display: none !important; }
      .report { width: auto; padding: 0; margin: 0; background: #fff; }
      .sheet { min-height: auto; margin: 0; padding: 0; border-radius: 0; box-shadow: none; page-break-after: always; }
      .sheet:last-child { page-break-after: auto; }
      .day-card, .sub-card, .summary-box, .gallery, .empty-gallery { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report">
    <section class="sheet cover-sheet">
      <div class="cover-hero">
        <img src="${coverImage}" alt="报告封面视觉" />
        <div class="cover-body">
          <span class="school-line">Hotel Management School · Training Base</span>
          <h1>饮品生产性实训基地<br/>学生实训报告</h1>
          <p class="lead">本报告用于记录学生在饮品生产性实训基地中的周度岗位实践、日常运营、创意策划、交接协作与总结反思，可直接用于打印、归档与课程过程评价。</p>
          <div class="meta-grid">
            <div class="meta-card"><span>教学周次</span><strong>${escapeHtml(teachingWeekText)}</strong></div>
            <div class="meta-card"><span>轮值周期</span><strong>${escapeHtml(week.startDate)} 至 ${escapeHtml(week.endDate)}</strong></div>
            <div class="meta-card"><span>实训学生</span><strong>${escapeHtml(reportOwners)}</strong></div>
            <div class="meta-card"><span>交接对象</span><strong>${escapeHtml(week.nextGroup || "待补充")}</strong></div>
          </div>
          <div class="report-index">
            <div class="index-item"><b>01</b><span>创意饮品策划</span></div>
            <div class="index-item"><b>02</b><span>每日运营执行</span></div>
            <div class="index-item"><b>03</b><span>交接班记录</span></div>
            <div class="index-item"><b>04</b><span>总结与反思</span></div>
          </div>
        </div>
      </div>
      <p class="footer-note">生成时间：${escapeHtml(new Date().toLocaleString())}</p>
    </section>

    <section class="sheet">
      <div class="section-head">
        <img src="${reportArt("creative", "创意饮品策划", "新品策划与海报表达")}" class="section-art" alt="创意策划插图" />
        <div>
          <p class="eyebrow">Creative Planning</p>
          <h2><span class="section-number">01</span>周三创意饮品策划提交</h2>
        </div>
      </div>
      <div class="summary-box">
        <p><b>行销计划：</b>${formatRichText(week.creative.marketing)}</p>
        <p><b>饮品配方与制作方法：</b>${formatRichText(week.creative.recipe)}</p>
        <p><b>特殊物料采购计划：</b>${formatRichText(week.creative.procurement)}</p>
      </div>
      <div class="sub-card">
        <h4>创意海报展示</h4>
        ${renderReportGallery(week.creative.posters, "creative", "本周未上传创意海报，已使用系统示意图补位。", true)}
      </div>
      <div class="approval">经理确认：${escapeHtml(renderApprovalText(week.creative.approval))}</div>
      <p class="footer-note">饮品生产性实训基地学生实训报告 · 创意策划</p>
    </section>

    <section class="sheet">
      <div class="section-head">
        <img src="${reportArt("daily", "每日运营执行", "签到、卫生、财务与签收")}" class="section-art" alt="每日运营插图" />
        <div>
          <p class="eyebrow">Daily Operations</p>
          <h2><span class="section-number">02</span>每日打卡与运营执行</h2>
        </div>
      </div>
      ${dailyHtml}
      <p class="footer-note">饮品生产性实训基地学生实训报告 · 每日运营</p>
    </section>

    <section class="sheet">
      <div class="section-head">
        <img src="${reportArt("handover", "交接班记录", "经验移交与岗位衔接")}" class="section-art" alt="交接班插图" />
        <div>
          <p class="eyebrow">Shift Handover</p>
          <h2><span class="section-number">03</span>交接班记录</h2>
        </div>
      </div>
      <div class="summary-box">
        <p><b>交接说明：</b>${formatRichText(week.handover.summary)}</p>
        <p><b>交接对象：</b>${formatRichText(week.handover.nextGroup || week.nextGroup)}</p>
      </div>
      <div class="sub-card">
        <h4>交接现场照片</h4>
        ${renderReportGallery(week.handover.photos, "handover", "未上传交接现场照片，已使用系统示意图补位。", true)}
      </div>
      <div class="approval">经理确认：${escapeHtml(renderApprovalText(week.handover.approval))}</div>
      <p class="footer-note">饮品生产性实训基地学生实训报告 · 交接班</p>
    </section>

    <section class="sheet">
      <div class="section-head">
        <img src="${reportArt("reflection", "总结与反思", "成长复盘与优化建议")}" class="section-art" alt="总结反思插图" />
        <div>
          <p class="eyebrow">Review Summary</p>
          <h2><span class="section-number">04</span>总结与反思</h2>
        </div>
      </div>
      <div class="two-column">
        <div class="sub-card">
          <h4>学员 A 自评与收获</h4>
          <p>${formatRichText(week.reflection.a)}</p>
        </div>
        <div class="sub-card">
          <h4>学员 B 自评与收获</h4>
          <p>${formatRichText(week.reflection.b)}</p>
        </div>
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
      <p class="footer-note">饮品生产性实训基地学生实训报告 · 总结反思</p>
    </section>
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
  const toolbar = `
    <div class="print-toolbar">
      <button type="button" onclick="window.print()">打印报告</button>
      <button type="button" onclick="window.close()">关闭预览</button>
    </div>
  `;
  previewWindow.document.open();
  previewWindow.document.write(html.replace("<body>", `<body>${toolbar}`));
  previewWindow.document.close();
  return true;
}
