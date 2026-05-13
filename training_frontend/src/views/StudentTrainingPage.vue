<script setup>
import { computed, onMounted, ref } from "vue";

import { getSession } from "../stores/authStore.js";
import { getStudentByUserId, updateStudentProgress } from "../api/students.js";
import { getPublishedTasks } from "../api/trainingTasks.js";
import { getSubmissionsByStudent, submitExercise } from "../api/submissions.js";
import { calcProgress } from "../utils/progress.js";
import MarkdownRenderer from "../components/MarkdownRenderer.vue";
import InteractiveExercise from "../components/InteractiveExercise.vue";
import TrainingProgressBar from "../components/TrainingProgressBar.vue";
import StatusBadge from "../components/StatusBadge.vue";

const session = computed(() => getSession());
const user = computed(() => session.value.user);

const loading = ref(true);
const errorMessage = ref("");
const student = ref(null);
const tasks = ref([]);
const submissions = ref([]);
const activeTaskId = ref("");
const submitStatus = ref({ saving: false, message: "", tone: "slate" });

const submissionByTaskId = computed(() => {
  const map = new Map();
  for (const s of submissions.value) map.set(s.task_id, s);
  return map;
});

const progress = computed(() => calcProgress({ tasks: tasks.value, submissions: submissions.value }));

const lastSubmittedAt = computed(() => {
  const times = submissions.value
    .map((s) => s.submitted_at || s.created)
    .filter(Boolean)
    .map((v) => new Date(v).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);
  if (!times.length) return "";
  return new Date(times[0]).toLocaleString("zh-CN");
});

const activeTask = computed(() => tasks.value.find((t) => t.id === activeTaskId.value) || tasks.value[0] || null);

const taskStatusText = (task) => {
  const sub = submissionByTaskId.value.get(task.id);
  if (!sub) return { tone: "slate", text: "未提交" };
  if (String(sub.status) === "completed" || Boolean(sub.is_correct)) return { tone: "emerald", text: "已完成" };
  if (String(sub.status) === "revision_required") return { tone: "rose", text: "需修改" };
  return { tone: "indigo", text: "已提交" };
};

const pickDefaultTask = () => {
  if (!tasks.value.length) return;
  const firstIncomplete = tasks.value.find((t) => {
    const sub = submissionByTaskId.value.get(t.id);
    return !(sub && (String(sub.status) === "completed" || Boolean(sub.is_correct)));
  });
  activeTaskId.value = (firstIncomplete || tasks.value[0]).id;
};

const syncStudentProgress = async () => {
  if (!student.value) return;
  const next = progress.value.percent;
  const current = Number(student.value.training_progress || 0);
  if (next === current) return;
  await updateStudentProgress(student.value.id, {
    training_progress: next,
    current_status: next >= 100 ? "completed" : (next > 0 ? "in_progress" : "not_started"),
  });
};

const load = async () => {
  loading.value = true;
  errorMessage.value = "";
  submitStatus.value = { saving: false, message: "", tone: "slate" };
  try {
    const u = user.value;
    if (!u) throw new Error("未登录。");
    const profile = await getStudentByUserId(u.id);
    student.value = profile;
    tasks.value = await getPublishedTasks();
    if (profile) {
      submissions.value = await getSubmissionsByStudent(profile.id);
    } else {
      submissions.value = [];
    }
    pickDefaultTask();
    if (profile) await syncStudentProgress();
  } catch (error) {
    errorMessage.value = error?.message || "加载失败。";
  } finally {
    loading.value = false;
  }
};

const handleExerciseSubmit = async ({ submittedAnswer, graded }) => {
  submitStatus.value = { saving: true, message: "", tone: "slate" };
  try {
    if (!student.value) throw new Error("未找到学生档案，请联系管理员在 Students 表关联当前用户。");
    if (!activeTask.value) throw new Error("当前没有可练习的任务。");

    await submitExercise({
      studentId: student.value.id,
      taskId: activeTask.value.id,
      submittedAnswer,
      graded,
      actorUserId: user.value?.id || "",
    });

    submissions.value = await getSubmissionsByStudent(student.value.id);
    await syncStudentProgress();
    submitStatus.value = {
      saving: false,
      message: graded.isCorrect ? "提交成功：已完成该任务。" : "提交成功：已记录结果，可继续修改再提交。",
      tone: graded.isCorrect ? "emerald" : "indigo",
    };
    pickDefaultTask();
  } catch (error) {
    submitStatus.value = { saving: false, message: error?.message || "提交失败。", tone: "rose" };
  }
};

onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <div class="panel-card p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">My Training</p>
          <h2 class="mt-2 text-2xl font-extrabold">我的实训任务</h2>
          <p class="mt-2 text-sm text-[var(--muted)]">按任务学习、练习、提交，系统实时记录进度。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="student" class="tag-pill">{{ student.name }}（{{ student.student_no }}）</span>
          <span v-else class="tag-pill">{{ user?.username }}</span>
          <span class="tag-pill">已发布任务 {{ progress.total }}</span>
        </div>
      </div>
    </div>

    <p v-if="errorMessage" class="status-line border-rose-200 bg-[var(--rose-soft)] text-[var(--rose-strong)]">{{ errorMessage }}</p>

    <div v-if="loading" class="status-line">正在加载任务与提交记录...</div>

    <template v-else>
      <TrainingProgressBar
        :percent="progress.percent"
        :completed="progress.completed"
        :total="progress.total"
        :status-text="student?.current_status || ''"
        :last-submitted-at="lastSubmittedAt"
      />

      <div class="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)_24rem]">
        <section class="panel-card p-5">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-extrabold">任务清单</h3>
            <span class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">Interactive</span>
          </div>
          <div class="mt-4 space-y-2">
            <button
              v-for="t in tasks"
              :key="t.id"
              type="button"
              class="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-left transition hover:bg-[var(--surface-soft)]"
              :class="t.id === activeTaskId ? 'ring-1 ring-emerald-200 shadow-[var(--shadow-sm)]' : ''"
              @click="activeTaskId = t.id"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-extrabold">{{ t.task_name }}</div>
                  <div class="mt-1 truncate text-xs text-[var(--muted)]">{{ t.module_code }}</div>
                </div>
                <StatusBadge v-bind="taskStatusText(t)" />
              </div>
            </button>
          </div>
        </section>

        <section class="panel-card p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">Guide</p>
              <h3 class="mt-2 text-lg font-extrabold">{{ activeTask?.task_name || "未选择任务" }}</h3>
            </div>
            <span v-if="activeTask?.deadline" class="tag-pill">截止：{{ new Date(activeTask.deadline).toLocaleDateString("zh-CN") }}</span>
          </div>

          <div class="mt-5">
            <MarkdownRenderer :content="activeTask?.markdown_content || '暂无指南内容。'" />
          </div>
        </section>

        <div class="space-y-4">
          <InteractiveExercise
            :exercise="activeTask?.interactive_exercise || null"
            :disabled="submitStatus.saving"
            @submit="handleExerciseSubmit"
          />
          <p
            v-if="submitStatus.message"
            class="status-line"
            :class="submitStatus.tone === 'emerald' ? 'border-emerald-200 bg-[var(--surface-emerald)] text-[var(--emerald-strong)]' : submitStatus.tone === 'rose' ? 'border-rose-200 bg-[var(--rose-soft)] text-[var(--rose-strong)]' : 'border-indigo-200 bg-[var(--surface-indigo)] text-[var(--indigo-strong)]'"
          >
            {{ submitStatus.message }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

