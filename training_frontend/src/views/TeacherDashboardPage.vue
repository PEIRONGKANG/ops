<script setup>
import { computed, onMounted, ref } from "vue";

import { getSession } from "../stores/authStore.js";
import { getStudents } from "../api/students.js";
import { getPublishedTasks } from "../api/trainingTasks.js";
import { getAllSubmissions } from "../api/submissions.js";
import { calcProgress } from "../utils/progress.js";

const session = computed(() => getSession());
const user = computed(() => session.value.user);

const loading = ref(true);
const errorMessage = ref("");
const query = ref("");
const sortKey = ref("student_no");
const sortDir = ref("asc");
const statusFilter = ref("all");

const students = ref([]);
const tasks = ref([]);
const submissions = ref([]);
const activeStudentId = ref("");

const submissionsByStudent = computed(() => {
  const map = new Map();
  for (const s of submissions.value) {
    const sid = s.student_id;
    if (!sid) continue;
    const bucket = map.get(sid) || [];
    bucket.push(s);
    map.set(sid, bucket);
  }
  return map;
});

function normalize(v) {
  return String(v ?? "").trim().toLowerCase();
}

const computedRows = computed(() => {
  const q = normalize(query.value);
  const publishedTasks = tasks.value;
  const totalTasks = publishedTasks.length;
  const rows = students.value.map((s) => {
    const subs = submissionsByStudent.value.get(s.id) || [];
    const { completed, percent } = calcProgress({ tasks: publishedTasks, submissions: subs });
    const avgScore = subs.length
      ? Math.round((subs.reduce((acc, item) => acc + Number(item.score || 0), 0) / subs.length) * 10) / 10
      : 0;
    const last = subs
      .map((item) => item.submitted_at || item.created)
      .filter(Boolean)
      .map((v) => new Date(v).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    const lastAt = last ? new Date(last).toLocaleString("zh-CN") : "";
    const status = percent >= 100 ? "completed" : (percent > 0 ? "in_progress" : "not_started");
    return {
      student: s,
      totalTasks,
      completed,
      percent,
      avgScore,
      lastAt,
      status,
      subs,
    };
  });

  const filtered = rows.filter((row) => {
    if (q) {
      const hay = `${row.student.name} ${row.student.student_no} ${row.student.class_name} ${row.student.group_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusFilter.value !== "all" && row.status !== statusFilter.value) return false;
    return true;
  });

  const dir = sortDir.value === "desc" ? -1 : 1;
  filtered.sort((a, b) => {
    const key = sortKey.value;
    const pick = (row) => {
      if (key === "student_no") return row.student.student_no;
      if (key === "percent") return row.percent;
      if (key === "avgScore") return row.avgScore;
      if (key === "lastAt") return row.lastAt ? new Date(row.lastAt).getTime() : 0;
      return row.student.student_no;
    };
    const va = pick(a);
    const vb = pick(b);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });

  return filtered;
});

const stats = computed(() => {
  const rows = computedRows.value;
  const studentCount = rows.length;
  const avgProgress = studentCount ? Math.round(rows.reduce((acc, r) => acc + r.percent, 0) / studentCount) : 0;
  const completedCount = rows.filter((r) => r.percent >= 100).length;
  const notCompletedCount = studentCount - completedCount;
  const pendingReview = rows.reduce(
    (acc, r) => acc + r.subs.filter((s) => String(s.status) === "submitted").length,
    0,
  );
  return { studentCount, avgProgress, completedCount, notCompletedCount, pendingReview };
});

const activeRow = computed(() => computedRows.value.find((r) => r.student.id === activeStudentId.value) || null);

const load = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    tasks.value = await getPublishedTasks();
    const list = await getStudents({ page: 1, perPage: 200, sort: "student_no" });
    students.value = list.items || [];
    // Keep submission query bounded; expand so detail view can show task names.
    const subList = await getAllSubmissions({ page: 1, perPage: 500, filter: "" });
    submissions.value = subList.items || [];
  } catch (error) {
    errorMessage.value = error?.message || "加载失败。";
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <div class="panel-card p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">Teacher Console</p>
          <h2 class="mt-2 text-2xl font-extrabold">学生实训进度总览</h2>
          <p class="mt-2 text-sm text-[var(--muted)]">支持按学号、进度、得分与最近提交排序，快速定位未完成与待确认学生。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="tag-pill">当前用户：{{ user?.name || user?.username }}</span>
          <span class="tag-pill">已发布任务：{{ tasks.length }}</span>
        </div>
      </div>
    </div>

    <p v-if="errorMessage" class="status-line border-rose-200 bg-[var(--rose-soft)] text-[var(--rose-strong)]">{{ errorMessage }}</p>
    <div v-if="loading" class="status-line">正在加载学生与提交记录...</div>

    <template v-else>
      <div class="grid gap-4 md:grid-cols-5">
        <div class="panel-card p-4 md:col-span-1">
          <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">学生总数</div>
          <div class="mt-2 text-2xl font-extrabold">{{ stats.studentCount }}</div>
        </div>
        <div class="panel-card p-4 md:col-span-1">
          <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">平均进度</div>
          <div class="mt-2 text-2xl font-extrabold">{{ stats.avgProgress }}%</div>
        </div>
        <div class="panel-card p-4 md:col-span-1">
          <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">已完成</div>
          <div class="mt-2 text-2xl font-extrabold">{{ stats.completedCount }}</div>
        </div>
        <div class="panel-card p-4 md:col-span-1">
          <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">未完成</div>
          <div class="mt-2 text-2xl font-extrabold">{{ stats.notCompletedCount }}</div>
        </div>
        <div class="panel-card p-4 md:col-span-1">
          <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">待确认提交</div>
          <div class="mt-2 text-2xl font-extrabold">{{ stats.pendingReview }}</div>
        </div>
      </div>

      <div class="panel-card p-5">
        <div class="grid gap-4 md:grid-cols-3">
          <div>
            <label class="field-label">搜索</label>
            <input class="field-input" v-model="query" placeholder="姓名 / 学号 / 班级 / 小组" />
          </div>
          <div>
            <label class="field-label">排序</label>
            <div class="mt-2 grid grid-cols-2 gap-3">
              <select class="field-input" v-model="sortKey">
                <option value="student_no">学号</option>
                <option value="percent">进度</option>
                <option value="avgScore">得分</option>
                <option value="lastAt">最近提交</option>
              </select>
              <select class="field-input" v-model="sortDir">
                <option value="asc">升序</option>
                <option value="desc">降序</option>
              </select>
            </div>
          </div>
          <div>
            <label class="field-label">状态筛选</label>
            <select class="field-input mt-2" v-model="statusFilter">
              <option value="all">全部</option>
              <option value="not_started">未开始</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
            </select>
          </div>
        </div>
      </div>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="panel-card overflow-hidden">
          <div class="overflow-auto">
            <table class="w-full min-w-[60rem] text-left text-sm">
              <thead class="bg-[var(--surface-soft)] text-xs font-extrabold tracking-[0.14em] text-[var(--muted)]">
                <tr>
                  <th class="px-4 py-3">姓名</th>
                  <th class="px-4 py-3">学号</th>
                  <th class="px-4 py-3">班级</th>
                  <th class="px-4 py-3">小组</th>
                  <th class="px-4 py-3">进度</th>
                  <th class="px-4 py-3">完成数</th>
                  <th class="px-4 py-3">平均得分</th>
                  <th class="px-4 py-3">最近提交</th>
                  <th class="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in computedRows"
                  :key="row.student.id"
                  class="border-t border-[var(--line)]"
                >
                  <td class="px-4 py-3 font-bold">{{ row.student.name }}</td>
                  <td class="px-4 py-3">{{ row.student.student_no }}</td>
                  <td class="px-4 py-3 text-[var(--muted)]">{{ row.student.class_name || "-" }}</td>
                  <td class="px-4 py-3 text-[var(--muted)]">{{ row.student.group_name || "-" }}</td>
                  <td class="px-4 py-3 font-extrabold text-[var(--emerald-strong)]">{{ row.percent }}%</td>
                  <td class="px-4 py-3">{{ row.completed }}/{{ row.totalTasks }}</td>
                  <td class="px-4 py-3">{{ row.avgScore }}</td>
                  <td class="px-4 py-3 text-[var(--muted)]">{{ row.lastAt || "-" }}</td>
                  <td class="px-4 py-3">
                    <button class="btn btn-secondary" type="button" @click="activeStudentId = row.student.id">
                      查看详情
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <aside class="panel-card p-5">
          <h3 class="text-lg font-extrabold">提交详情</h3>
          <p v-if="!activeRow" class="status-line mt-4">从左侧列表选择一位学生以查看提交记录。</p>
          <div v-else class="mt-4 space-y-3">
            <div class="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
              <div class="text-sm font-extrabold">{{ activeRow.student.name }}（{{ activeRow.student.student_no }}）</div>
              <div class="mt-1 text-sm text-[var(--muted)]">进度：{{ activeRow.percent }}%，最近提交：{{ activeRow.lastAt || "-" }}</div>
            </div>
            <div class="space-y-2">
              <div
                v-for="sub in activeRow.subs.slice(0, 8)"
                :key="sub.id"
                class="rounded-2xl border border-[var(--line)] bg-white p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate text-sm font-extrabold">{{ sub.expand?.task_id?.task_name || sub.task_id }}</div>
                    <div class="mt-1 text-xs text-[var(--muted)]">{{ sub.submitted_at ? new Date(sub.submitted_at).toLocaleString("zh-CN") : "-" }}</div>
                  </div>
                  <span class="tag-pill">得分 {{ sub.score || 0 }}</span>
                </div>
                <RouterLink class="mt-3 inline-block text-sm font-bold text-[var(--emerald-strong)]" :to="`/submissions/${sub.id}`">
                  打开详情
                </RouterLink>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

