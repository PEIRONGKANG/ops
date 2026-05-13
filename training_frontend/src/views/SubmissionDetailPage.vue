<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import { getSession } from "../stores/authStore.js";
import { getStudentByUserId } from "../api/students.js";
import { getSubmissionDetail, reviewSubmission } from "../api/submissions.js";
import StatusBadge from "../components/StatusBadge.vue";

const route = useRoute();
const session = computed(() => getSession());
const user = computed(() => session.value.user);

const loading = ref(true);
const errorMessage = ref("");
const submission = ref(null);
const teacherComment = ref("");
const statusValue = ref("");
const saving = ref(false);

const canEditReview = computed(() => {
  const role = String(user.value?.role_code || "");
  return role === "P1" || role === "T1";
});

const statusBadge = computed(() => {
  const value = String(submission.value?.status || "");
  if (value === "completed") return { tone: "emerald", text: "已完成" };
  if (value === "reviewed") return { tone: "emerald", text: "已批阅" };
  if (value === "revision_required") return { tone: "rose", text: "需修改" };
  if (value === "submitted") return { tone: "indigo", text: "已提交" };
  return { tone: "slate", text: value || "未知" };
});

const load = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const id = String(route.params.id || "");
    if (!id) throw new Error("缺少提交记录 ID。");
    const detail = await getSubmissionDetail(id);

    // Permission: P3 can only view their own submissions.
    const role = String(user.value?.role_code || "");
    if (role === "P3") {
      const profile = await getStudentByUserId(user.value.id);
      if (!profile || profile.id !== detail.student_id) {
        throw new Error("无权限查看该提交记录。");
      }
    }

    submission.value = detail;
    teacherComment.value = detail.teacher_comment || "";
    statusValue.value = detail.status || "";
  } catch (error) {
    errorMessage.value = error?.message || "加载失败。";
  } finally {
    loading.value = false;
  }
};

const handleSave = async () => {
  if (!submission.value) return;
  saving.value = true;
  errorMessage.value = "";
  try {
    const patch = {
      teacher_comment: teacherComment.value,
      status: statusValue.value,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.value?.id || "",
    };
    const next = await reviewSubmission(submission.value.id, patch);
    submission.value = { ...submission.value, ...next };
  } catch (error) {
    errorMessage.value = error?.message || "保存失败。";
  } finally {
    saving.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <div class="panel-card p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">Submission</p>
          <h2 class="mt-2 text-2xl font-extrabold">提交详情</h2>
        </div>
        <StatusBadge v-if="submission" v-bind="statusBadge" />
      </div>
    </div>

    <p v-if="errorMessage" class="status-line border-rose-200 bg-[var(--rose-soft)] text-[var(--rose-strong)]">{{ errorMessage }}</p>
    <div v-if="loading" class="status-line">正在加载提交详情...</div>

    <template v-else-if="submission">
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section class="panel-card p-5">
          <h3 class="text-lg font-extrabold">记录信息</h3>
          <div class="mt-4 grid gap-3 md:grid-cols-2">
            <div class="status-line">
              <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">学生</div>
              <div class="mt-2 font-bold">
                {{ submission.expand?.student_id?.name || submission.student_id }}
                <span class="text-[var(--muted)]">（{{ submission.expand?.student_id?.student_no || "-" }}）</span>
              </div>
            </div>
            <div class="status-line">
              <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">任务</div>
              <div class="mt-2 font-bold">{{ submission.expand?.task_id?.task_name || submission.task_id }}</div>
            </div>
            <div class="status-line">
              <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">提交时间</div>
              <div class="mt-2 font-bold">
                {{ submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("zh-CN") : "-" }}
              </div>
            </div>
            <div class="status-line">
              <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">得分</div>
              <div class="mt-2 font-bold">{{ submission.score || 0 }}</div>
            </div>
          </div>

          <div class="mt-5">
            <h4 class="text-sm font-extrabold tracking-[0.16em] text-[var(--muted)]">学生答案（JSON）</h4>
            <pre class="mt-2 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-xs">{{ JSON.stringify(submission.submitted_answer, null, 2) }}</pre>
          </div>

          <div class="mt-5">
            <h4 class="text-sm font-extrabold tracking-[0.16em] text-[var(--muted)]">系统反馈</h4>
            <p class="status-line mt-2">{{ submission.feedback || "-" }}</p>
          </div>
        </section>

        <aside class="panel-card p-5">
          <h3 class="text-lg font-extrabold">批阅与评语</h3>
          <div class="mt-4 space-y-4">
            <div>
              <label class="field-label">状态</label>
              <select class="field-input mt-2" v-model="statusValue" :disabled="!canEditReview">
                <option value="draft">草稿</option>
                <option value="submitted">已提交</option>
                <option value="completed">已完成</option>
                <option value="revision_required">需修改</option>
                <option value="reviewed">已批阅</option>
              </select>
            </div>
            <div>
              <label class="field-label">教师评语</label>
              <textarea class="field-input mt-2 min-h-[10rem]" v-model="teacherComment" :disabled="!canEditReview" />
            </div>
            <button class="btn btn-primary w-full" type="button" :disabled="saving || !canEditReview" @click="handleSave">
              {{ saving ? "保存中..." : "保存评语" }}
            </button>
            <p v-if="!canEditReview" class="status-line">当前角色仅可查看，不允许修改评语。</p>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

