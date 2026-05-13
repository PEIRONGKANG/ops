<script setup>
import { computed, onMounted, ref } from "vue";

import { getSession } from "../stores/authStore.js";
import { createTask, getAllTasks, updateTask } from "../api/trainingTasks.js";
import MarkdownRenderer from "../components/MarkdownRenderer.vue";
import StatusBadge from "../components/StatusBadge.vue";

const session = computed(() => getSession());
const user = computed(() => session.value.user);

const canEdit = computed(() => String(user.value?.role_code || "") === "P1");

const loading = ref(true);
const errorMessage = ref("");
const tasks = ref([]);

const editorOpen = ref(false);
const editorMode = ref("create"); // create/edit
const editor = ref({
  id: "",
  task_name: "",
  module_code: "",
  markdown_content: "",
  interactive_exercise: "{}",
  deadline: "",
  total_score: 100,
  status: "draft",
  sort_order: 0,
});
const previewOpen = ref(false);

const badgeForStatus = (value) => {
  const status = String(value || "");
  if (status === "published") return { tone: "emerald", text: "已发布" };
  if (status === "closed") return { tone: "indigo", text: "已截止" };
  if (status === "archived") return { tone: "slate", text: "已归档" };
  return { tone: "slate", text: "草稿" };
};

const openCreate = () => {
  editorMode.value = "create";
  editor.value = {
    id: "",
    task_name: "",
    module_code: "",
    markdown_content: "",
    interactive_exercise: "{}",
    deadline: "",
    total_score: 100,
    status: "draft",
    sort_order: 0,
  };
  editorOpen.value = true;
};

const openEdit = (task) => {
  editorMode.value = "edit";
  editor.value = {
    id: task.id,
    task_name: task.task_name || "",
    module_code: task.module_code || "",
    markdown_content: task.markdown_content || "",
    interactive_exercise: JSON.stringify(task.interactive_exercise || {}, null, 2),
    deadline: task.deadline ? String(task.deadline).slice(0, 10) : "",
    total_score: Number(task.total_score || 100),
    status: task.status || "draft",
    sort_order: Number(task.sort_order || 0),
  };
  editorOpen.value = true;
};

const handleSave = async () => {
  errorMessage.value = "";
  try {
    const payload = {
      task_name: editor.value.task_name,
      module_code: editor.value.module_code,
      markdown_content: editor.value.markdown_content,
      interactive_exercise: JSON.parse(editor.value.interactive_exercise || "{}"),
      deadline: editor.value.deadline ? new Date(editor.value.deadline).toISOString() : "",
      total_score: Number(editor.value.total_score || 100),
      status: editor.value.status,
      sort_order: Number(editor.value.sort_order || 0),
      created_by: user.value?.id || "",
    };
    if (editorMode.value === "edit") {
      await updateTask(editor.value.id, payload);
    } else {
      await createTask(payload);
    }
    editorOpen.value = false;
    await load();
  } catch (error) {
    errorMessage.value = error?.message || "保存失败。";
  }
};

const load = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    tasks.value = await getAllTasks();
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
          <p class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">Task Studio</p>
          <h2 class="mt-2 text-2xl font-extrabold">实训任务管理</h2>
          <p class="mt-2 text-sm text-[var(--muted)]">P1 可编辑，T1 可查看。任务内容支持 Markdown + 交互式练习 JSON。</p>
        </div>
        <button v-if="canEdit" class="btn btn-primary" type="button" @click="openCreate">新增任务</button>
      </div>
    </div>

    <p v-if="errorMessage" class="status-line border-rose-200 bg-[var(--rose-soft)] text-[var(--rose-strong)]">{{ errorMessage }}</p>
    <div v-if="loading" class="status-line">正在加载任务列表...</div>

    <div v-else class="panel-card overflow-hidden">
      <div class="overflow-auto">
        <table class="w-full min-w-[62rem] text-left text-sm">
          <thead class="bg-[var(--surface-soft)] text-xs font-extrabold tracking-[0.14em] text-[var(--muted)]">
            <tr>
              <th class="px-4 py-3">排序</th>
              <th class="px-4 py-3">任务名称</th>
              <th class="px-4 py-3">模块</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">截止日期</th>
              <th class="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tasks" :key="t.id" class="border-t border-[var(--line)]">
              <td class="px-4 py-3">{{ t.sort_order || 0 }}</td>
              <td class="px-4 py-3 font-bold">{{ t.task_name }}</td>
              <td class="px-4 py-3 text-[var(--muted)]">{{ t.module_code }}</td>
              <td class="px-4 py-3">
                <StatusBadge v-bind="badgeForStatus(t.status)" />
              </td>
              <td class="px-4 py-3 text-[var(--muted)]">{{ t.deadline ? new Date(t.deadline).toLocaleDateString('zh-CN') : '-' }}</td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  <button class="btn btn-secondary" type="button" @click="() => { editorMode = 'edit'; openEdit(t); }" :disabled="!canEdit">
                    编辑
                  </button>
                  <button class="btn btn-secondary" type="button" @click="() => { editor = { ...editor, markdown_content: t.markdown_content || '' }; previewOpen = true; }">
                    预览
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="editorOpen" class="fixed inset-0 z-50 bg-black/30 p-4">
      <div class="panel-card mx-auto max-w-4xl p-6">
        <div class="flex items-start justify-between gap-4">
          <h3 class="text-lg font-extrabold">{{ editorMode === 'edit' ? '编辑任务' : '新增任务' }}</h3>
          <button class="btn btn-secondary" type="button" @click="editorOpen = false">关闭</button>
        </div>
        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label class="field-label">任务名称</label>
            <input class="field-input mt-2" v-model="editor.task_name" />
          </div>
          <div>
            <label class="field-label">模块 code</label>
            <input class="field-input mt-2" v-model="editor.module_code" placeholder="creative_planning / daily_operation ..." />
          </div>
          <div>
            <label class="field-label">状态</label>
            <select class="field-input mt-2" v-model="editor.status">
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="closed">已截止</option>
              <option value="archived">已归档</option>
            </select>
          </div>
          <div>
            <label class="field-label">截止日期</label>
            <input class="field-input mt-2" type="date" v-model="editor.deadline" />
          </div>
          <div>
            <label class="field-label">总分</label>
            <input class="field-input mt-2" type="number" v-model="editor.total_score" />
          </div>
          <div>
            <label class="field-label">排序</label>
            <input class="field-input mt-2" type="number" v-model="editor.sort_order" />
          </div>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label class="field-label">Markdown 内容</label>
            <textarea class="field-input mt-2 min-h-[18rem]" v-model="editor.markdown_content" />
          </div>
          <div>
            <label class="field-label">交互练习 JSON</label>
            <textarea class="field-input mt-2 min-h-[18rem] font-mono text-xs" v-model="editor.interactive_exercise" />
            <p class="mt-2 text-xs text-[var(--muted)]">至少支持：single_choice / multiple_choice / text_input。</p>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap justify-end gap-3">
          <button class="btn btn-secondary" type="button" @click="editorOpen = false">取消</button>
          <button class="btn btn-primary" type="button" @click="handleSave">保存</button>
        </div>
      </div>
    </div>

    <div v-if="previewOpen" class="fixed inset-0 z-40 bg-black/30 p-4">
      <div class="panel-card mx-auto max-w-4xl p-6">
        <div class="flex items-start justify-between gap-4">
          <h3 class="text-lg font-extrabold">任务预览</h3>
          <button class="btn btn-secondary" type="button" @click="previewOpen = false">关闭</button>
        </div>
        <div class="mt-4">
          <MarkdownRenderer :content="editor.markdown_content" />
        </div>
      </div>
    </div>
  </div>
</template>

