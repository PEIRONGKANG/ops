<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";

import { loginWithPassword } from "../stores/authStore.js";

const router = useRouter();
const identity = ref("");
const password = ref("");
const errorMessage = ref("");
const loading = ref(false);

const handleSubmit = async () => {
  errorMessage.value = "";
  loading.value = true;
  try {
    await loginWithPassword(identity.value.trim(), password.value);
    router.replace("/home");
  } catch (error) {
    errorMessage.value = error?.message || "登录失败，请检查账号和密码。";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="mx-auto max-w-xl">
    <div class="panel-card p-6">
      <p class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">Access</p>
      <h2 class="mt-2 text-2xl font-extrabold">登录</h2>
      <p class="mt-2 text-sm text-[var(--muted)]">使用 PocketBase 账号登录（学号/工号）。</p>

      <div class="mt-6 grid gap-4">
        <div>
          <label class="field-label">账号</label>
          <input class="field-input" v-model="identity" autocomplete="username" />
        </div>
        <div>
          <label class="field-label">密码</label>
          <input class="field-input" type="password" v-model="password" autocomplete="current-password" />
        </div>
        <p v-if="errorMessage" class="status-line border-rose-200 bg-[var(--rose-soft)] text-[var(--rose-strong)]">{{ errorMessage }}</p>
        <button class="btn btn-primary" type="button" :disabled="loading" @click="handleSubmit">
          {{ loading ? "登录中..." : "登录" }}
        </button>
      </div>
    </div>

    <p class="mt-4 text-sm text-[var(--muted)]">
      首次部署后需要在 PocketBase 管理后台创建用户与角色字段（`role_code`）。
    </p>
  </div>
</template>

