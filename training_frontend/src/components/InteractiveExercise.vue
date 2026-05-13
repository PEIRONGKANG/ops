<script setup>
import { computed, ref, watch } from "vue";

import { gradeExercise } from "../utils/exerciseGrader.js";

const props = defineProps({
  exercise: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["submit"]);

const localAnswer = ref("");
const localMulti = ref([]);
const result = ref(null);

watch(
  () => props.exercise,
  () => {
    localAnswer.value = "";
    localMulti.value = [];
    result.value = null;
  },
);

const type = computed(() => String(props.exercise?.type || ""));
const isSingle = computed(() => type.value === "single_choice");
const isMulti = computed(() => type.value === "multiple_choice");
const isText = computed(() => type.value === "text_input");

const options = computed(() => Array.isArray(props.exercise?.options) ? props.exercise.options : []);

const canSubmit = computed(() => {
  if (props.disabled) return false;
  if (isSingle.value) return String(localAnswer.value).trim().length > 0;
  if (isMulti.value) return localMulti.value.length > 0;
  if (isText.value) return String(localAnswer.value).trim().length > 0;
  return false;
});

const handleSubmit = async () => {
  const exercise = props.exercise;
  if (!exercise) return;

  const submitted = isMulti.value ? [...localMulti.value] : localAnswer.value;
  const graded = gradeExercise(exercise, submitted);
  result.value = graded;
  emit("submit", { submittedAnswer: submitted, graded });
};
</script>

<template>
  <section class="panel-card p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">Interactive Exercise</p>
        <h3 class="mt-2 text-lg font-extrabold">实时练习</h3>
      </div>
      <span v-if="exercise?.score" class="tag-pill">本题 {{ exercise.score }} 分</span>
    </div>

    <div v-if="!exercise" class="status-line mt-4">
      当前任务未配置练习题。
    </div>

    <div v-else class="mt-4 space-y-4">
      <p class="text-base font-semibold">{{ exercise.question }}</p>

      <div v-if="isSingle" class="space-y-2">
        <label
          v-for="opt in options"
          :key="opt.label"
          class="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 hover:bg-[var(--surface-soft)]"
        >
          <input type="radio" name="single" :value="opt.label" v-model="localAnswer" :disabled="disabled" />
          <div class="min-w-0">
            <div class="text-sm font-bold text-[var(--muted)]">{{ opt.label }}</div>
            <div class="text-sm">{{ opt.text }}</div>
          </div>
        </label>
      </div>

      <div v-else-if="isMulti" class="space-y-2">
        <label
          v-for="opt in options"
          :key="opt.label"
          class="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 hover:bg-[var(--surface-soft)]"
        >
          <input type="checkbox" :value="opt.label" v-model="localMulti" :disabled="disabled" />
          <div class="min-w-0">
            <div class="text-sm font-bold text-[var(--muted)]">{{ opt.label }}</div>
            <div class="text-sm">{{ opt.text }}</div>
          </div>
        </label>
      </div>

      <div v-else-if="isText">
        <label class="field-label">输入答案</label>
        <input class="field-input mt-2" v-model="localAnswer" :disabled="disabled" />
      </div>

      <div v-else class="status-line">
        暂不支持的题型：{{ exercise.type }}
      </div>

      <button class="btn btn-primary w-full" type="button" :disabled="!canSubmit" @click="handleSubmit">
        提交练习
      </button>

      <div v-if="result" class="space-y-2">
        <p class="status-line" :class="result.isCorrect ? 'border-emerald-200 bg-[var(--surface-emerald)] text-[var(--emerald-strong)]' : 'border-rose-200 bg-[var(--rose-soft)] text-[var(--rose-strong)]'">
          {{ result.feedback }} 得分：{{ result.score }}
        </p>
        <p v-if="result.explanation" class="status-line">{{ result.explanation }}</p>
      </div>
    </div>
  </section>
</template>

