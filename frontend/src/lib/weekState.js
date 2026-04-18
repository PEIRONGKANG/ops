import { createEmptyWeek, emptyApproval } from "./core.js";

function cloneApproval(approval = {}) {
  return {
    by: approval.by || "",
    time: approval.time || "",
    comment: approval.comment || "",
  };
}

export function cloneCreativeSection(creative = {}) {
  return {
    marketing: creative.marketing || "",
    recipe: creative.recipe || "",
    procurement: creative.procurement || "",
    posters: Array.isArray(creative.posters) ? [...creative.posters] : [],
    approval: cloneApproval(creative.approval || emptyApproval()),
  };
}

export function cloneHandoverSection(handover = {}) {
  return {
    summary: handover.summary || "",
    nextGroup: handover.nextGroup || "",
    photos: Array.isArray(handover.photos) ? [...handover.photos] : [],
    approval: cloneApproval(handover.approval || emptyApproval()),
  };
}

export function cloneReflectionSection(reflection = {}) {
  return {
    a: reflection.a || "",
    b: reflection.b || "",
    optPlan: reflection.optPlan || "",
    managerComment: reflection.managerComment || "",
    approval: cloneApproval(reflection.approval || emptyApproval()),
  };
}

export function cloneWeekForScopedMutation(week, startDate = week?.startDate || "") {
  const base = week || createEmptyWeek(startDate);
  return {
    ...base,
    members: { ...(base.members || { a: "", b: "" }) },
    creative: base.creative || createEmptyWeek(startDate).creative,
    daily: base.daily || {},
    handover: {
      ...(base.handover || createEmptyWeek(startDate).handover),
    },
    reflection: base.reflection || createEmptyWeek(startDate).reflection,
  };
}

export function updateWeekCreative(week, mutator) {
  const nextWeek = {
    ...week,
    creative: cloneCreativeSection(week.creative),
  };
  mutator(nextWeek.creative, nextWeek);
  return nextWeek;
}

export function updateWeekHandover(week, mutator) {
  const nextWeek = {
    ...week,
    handover: cloneHandoverSection(week.handover),
  };
  mutator(nextWeek.handover, nextWeek);
  return nextWeek;
}

export function updateWeekReflection(week, mutator) {
  const nextWeek = {
    ...week,
    reflection: cloneReflectionSection(week.reflection),
  };
  mutator(nextWeek.reflection, nextWeek);
  return nextWeek;
}
