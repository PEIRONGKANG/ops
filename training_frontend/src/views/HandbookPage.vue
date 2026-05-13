<script setup>
import { computed, ref } from "vue";

import { HANDBOOK_SECTIONS } from "../content/handbook.js";

const STORAGE_KEY = "ops_training_handbook_state_v1";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
  } catch {
    return {};
  }
}

function saveState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

const persisted = ref(loadState());
const query = ref("");
const openSectionId = ref(persisted.value.openSectionId || "");

const readSet = computed(() => new Set(persisted.value.read || []));
const checklistMap = computed(() => persisted.value.checklist || {});

const filteredSections = computed(() => {
  const q = String(query.value || "").trim().toLowerCase();
  if (!q) return HANDBOOK_SECTIONS;
  return HANDBOOK_SECTIONS.filter((section) => {
    const hay = `${section.title} ${section.summary} ${JSON.stringify(section.blocks || [])}`.toLowerCase();
    return hay.includes(q);
  });
});

const progress = computed(() => {
  const total = HANDBOOK_SECTIONS.length || 1;
  const read = readSet.value.size;
  const percent = Math.round((read / total) * 100);
  return { total, read, percent };
});

const toggleSection = (id) => {
  openSectionId.value = openSectionId.value === id ? "" : id;
  persisted.value = { ...persisted.value, openSectionId: openSectionId.value };
  saveState(persisted.value);
  if (openSectionId.value) {
    const read = Array.from(new Set([...(persisted.value.read || []), id]));
    persisted.value = { ...persisted.value, read };
    saveState(persisted.value);
  }
};

const toggleChecklist = (sectionId, index) => {
  const key = `${sectionId}::${index}`;
  const nextChecklist = { ...(persisted.value.checklist || {}) };
  nextChecklist[key] = !nextChecklist[key];
  persisted.value = { ...persisted.value, checklist: nextChecklist };
  saveState(persisted.value);
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
};
</script>

<template>
  <div class="space-y-5">
    <div class="panel-card p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">Handbook</p>
          <h2 class="mt-2 text-2xl font-extrabold">基地学员岗位说明</h2>
          <p class="mt-2 text-sm text-[var(--muted)]">交互式手册：折叠、搜索、自查清单与阅读进度。</p>
        </div>
        <div class="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3">
          <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">阅读进度</div>
          <div class="mt-2 flex items-center justify-between gap-4">
            <div class="text-xl font-extrabold">{{ progress.percent }}%</div>
            <div class="text-sm text-[var(--muted)]">{{ progress.read }}/{{ progress.total }}</div>
          </div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div class="h-full rounded-full bg-[var(--emerald)]" :style="{ width: `${progress.percent}%` }" />
          </div>
        </div>
      </div>
      <div class="mt-5">
        <label class="field-label">搜索</label>
        <input class="field-input mt-2" v-model="query" placeholder="搜索：理念、礼仪、个人信息保护、应急..." />
      </div>
    </div>

    <div class="space-y-3">
      <section v-for="section in filteredSections" :key="section.id" class="panel-card overflow-hidden">
        <button
          type="button"
          class="flex w-full items-start justify-between gap-4 bg-white px-6 py-5 text-left hover:bg-[var(--surface-soft)]"
          @click="toggleSection(section.id)"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-lg font-extrabold">{{ section.title }}</h3>
              <span class="tag-pill" v-if="readSet.has(section.id)">已阅读</span>
            </div>
            <p class="mt-2 text-sm text-[var(--muted)]">{{ section.summary }}</p>
          </div>
          <div class="text-sm font-extrabold text-[var(--muted)]">
            {{ openSectionId === section.id ? "收起" : "展开" }}
          </div>
        </button>

        <div v-if="openSectionId === section.id" class="border-t border-[var(--line)] bg-[var(--surface-soft)] p-6">
          <div class="grid gap-4 lg:grid-cols-2">
            <div
              v-for="(block, index) in section.blocks"
              :key="`${section.id}-${index}`"
              class="rounded-2xl border border-[var(--line)] bg-white p-5"
            >
              <h4 class="text-sm font-extrabold tracking-[0.16em] text-[var(--muted)]">{{ block.title }}</h4>

              <p v-if="block.kind === 'text'" class="mt-3 text-sm leading-relaxed text-[var(--ink)]">
                {{ block.content }}
              </p>

              <div v-else-if="block.kind === 'cards'" class="mt-4 space-y-3">
                <div
                  v-for="card in block.cards"
                  :key="card.title"
                  class="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4"
                >
                  <div class="text-sm font-extrabold">{{ card.title }}</div>
                  <div class="mt-2 text-sm text-[var(--muted)]">{{ card.content }}</div>
                </div>
              </div>

              <div v-else-if="block.kind === 'table'" class="mt-4 overflow-auto">
                <table class="min-w-[34rem] text-sm">
                  <thead class="bg-[var(--surface-soft)] text-xs font-extrabold tracking-[0.14em] text-[var(--muted)]">
                    <tr>
                      <th v-for="h in block.headers" :key="h" class="px-3 py-2">{{ h }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, rIndex) in block.rows" :key="rIndex" class="border-t border-[var(--line)]">
                      <td v-for="(cell, cIndex) in row" :key="cIndex" class="px-3 py-2">{{ cell }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else-if="block.kind === 'phrases'" class="mt-4 space-y-3">
                <div
                  v-for="phrase in block.phrases"
                  :key="phrase.label"
                  class="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">{{ phrase.label }}</div>
                      <div class="mt-2 text-sm font-semibold">{{ phrase.text }}</div>
                    </div>
                    <button class="btn btn-secondary" type="button" @click="copyText(phrase.text)">复制</button>
                  </div>
                </div>
              </div>

              <div v-else-if="block.kind === 'checklist'" class="mt-4 space-y-2">
                <label
                  v-for="(item, i) in block.items"
                  :key="`${section.id}-${i}`"
                  class="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3"
                >
                  <input type="checkbox" :checked="Boolean(checklistMap[`${section.id}::${i}`])" @change="toggleChecklist(section.id, i)" />
                  <span class="text-sm">{{ item }}</span>
                </label>
              </div>

              <div v-else class="mt-3 text-sm text-[var(--muted)]">未知模块类型：{{ block.kind }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

