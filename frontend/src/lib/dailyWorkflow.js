function trimValue(value) {
  return String(value ?? "").trim();
}

function hasImages(images) {
  return Array.isArray(images) && images.length > 0;
}

function hasText(...values) {
  return values.some((value) => trimValue(value));
}

function allText(...values) {
  return values.every((value) => trimValue(value));
}

function emptyApproval() {
  return { by: "", time: "", comment: "" };
}

export function createEmptyManagerReview() {
  return {
    attendance: "",
    opening: "",
    closing: "",
    finance: "",
    receipt: "",
    notes: "",
    submittedBy: "",
    submittedAt: "",
  };
}

export function ensureManagerReview(reviewLike = {}) {
  return {
    ...createEmptyManagerReview(),
    ...reviewLike,
  };
}

export function getDailyRoleCapabilities(level) {
  const isManager = level === "P1" || level === "P2";
  const isStudent = level === "P3";

  return {
    canEditRawFields: isManager || isStudent,
    canUploadImages: isStudent,
    canEditManagerReview: isManager,
    canSubmitManagerReview: isManager,
  };
}

export function canEditDailyField(level, field) {
  const { canEditRawFields } = getDailyRoleCapabilities(level);
  if (!canEditRawFields) return false;

  return ![
    "grooming",
    "openingPublic",
    "openingBar",
    "closingPublic",
    "closingBar",
    "lossImgs",
    "inventoryImgs",
    "receiptImgs",
  ].includes(field);
}

export function canUploadDailyImages(level) {
  return getDailyRoleCapabilities(level).canUploadImages;
}

function hasAttendanceEvidence(day = {}) {
  return hasText(day.checkIn, day.checkOut, day.attendanceNote);
}

function hasOpeningEvidence(day = {}) {
  return hasImages(day.openingPublic) || hasImages(day.openingBar);
}

function hasClosingEvidence(day = {}) {
  return hasImages(day.closingPublic) || hasImages(day.closingBar);
}

function hasFinanceEvidence(day = {}) {
  return hasText(day.sales, day.cost, day.lossAmount, day.lossDesc, day.inventoryDesc)
    || hasImages(day.lossImgs)
    || hasImages(day.inventoryImgs);
}

function hasReceiptEvidence(day = {}) {
  return hasText(day.receiptDesc) || hasImages(day.receiptImgs);
}

export function canSubmitManagerReview(level, dayLike = {}) {
  if (!getDailyRoleCapabilities(level).canSubmitManagerReview) return false;

  const day = {
    ...dayLike,
    managerReview: ensureManagerReview(dayLike.managerReview),
  };

  return hasAttendanceEvidence(day)
    && hasOpeningEvidence(day)
    && hasClosingEvidence(day)
    && hasFinanceEvidence(day)
    && hasReceiptEvidence(day)
    && allText(
      day.managerReview.attendance,
      day.managerReview.opening,
      day.managerReview.closing,
      day.managerReview.finance,
      day.managerReview.receipt,
      day.managerReview.notes,
    );
}

export function submitManagerReview(day, actor = {}, submittedAt = "") {
  const review = ensureManagerReview(day.managerReview);
  const by = trimValue(actor.displayName) || trimValue(actor.username);
  const time = trimValue(submittedAt);

  review.submittedBy = by;
  review.submittedAt = time;
  day.managerReview = review;

  const approvals = day.approvals || {};
  ["checkIn", "checkOut", "grooming", "opening", "closing", "finance", "receipt"].forEach((key) => {
    approvals[key] = {
      ...emptyApproval(),
      ...(approvals[key] || {}),
      by,
      time,
    };
  });
  day.approvals = approvals;
  return day;
}

export function renderManagerReviewText(reviewLike = {}) {
  const review = ensureManagerReview(reviewLike);
  if (!trimValue(review.submittedBy)) return "待 P2 确认";
  return `已由 P2 确认：${review.submittedBy}（${review.submittedAt || "-"}）`;
}
