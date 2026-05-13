<script setup>
import { computed } from "vue";

const props = defineProps({
  tone: { type: String, default: "slate" }, // emerald, rose, indigo, slate
  text: { type: String, default: "" },
});

const className = computed(() => {
  const tone = String(props.tone || "slate");
  if (tone === "emerald") return "border-emerald-200 bg-[var(--surface-emerald)] text-[var(--emerald-strong)]";
  if (tone === "rose") return "border-rose-200 bg-[var(--rose-soft)] text-[var(--rose-strong)]";
  if (tone === "indigo") return "border-indigo-200 bg-[var(--surface-indigo)] text-[var(--indigo-strong)]";
  return "border-[var(--line)] bg-[var(--surface-soft)] text-[var(--muted)]";
});
</script>

<template>
  <span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold tracking-wide" :class="className">
    {{ text }}
  </span>
</template>

