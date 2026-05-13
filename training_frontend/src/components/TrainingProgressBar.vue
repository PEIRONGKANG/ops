<script setup>
import { computed } from "vue";

const props = defineProps({
  percent: { type: Number, default: 0 },
  completed: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  statusText: { type: String, default: "" },
  lastSubmittedAt: { type: String, default: "" },
});

const barStyle = computed(() => ({ width: `${Math.min(100, Math.max(0, props.percent || 0))}%` }));
</script>

<template>
  <div class="panel-card p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">Progress</p>
        <h3 class="mt-2 text-lg font-extrabold">实训进度</h3>
      </div>
      <span class="tag-pill">{{ completed }}/{{ total }} 已完成</span>
    </div>

    <div class="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-3">
      <div class="flex items-center justify-between text-sm font-bold text-[var(--muted)]">
        <span>{{ percent }}%</span>
        <span v-if="statusText">{{ statusText }}</span>
      </div>
      <div class="mt-3 h-3 overflow-hidden rounded-full bg-white">
        <div class="h-full rounded-full bg-[var(--emerald)]" :style="barStyle" />
      </div>
      <p v-if="lastSubmittedAt" class="mt-3 text-sm text-[var(--muted)]">最近提交：{{ lastSubmittedAt }}</p>
    </div>
  </div>
</template>

