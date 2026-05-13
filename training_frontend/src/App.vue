<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { getSession, logout } from "./stores/authStore.js";

const route = useRoute();
const router = useRouter();

const session = computed(() => getSession());
const user = computed(() => session.value.user);

const navItems = computed(() => {
  const role = String(user.value?.role_code || "P3");
  const base = [
    { to: "/home", label: "我的实训任务", roles: ["P1", "T1", "P2", "P3"] },
    { to: "/handbook", label: "基地学员岗位说明", roles: ["P1", "T1", "P2", "P3"] },
  ];
  const teacher = [
    { to: "/teacher", label: "学生实训进度总览", roles: ["P1", "T1", "P2"] },
    { to: "/tasks", label: "实训任务管理", roles: ["P1", "T1"] },
  ];
  return [...base, ...teacher].filter((item) => item.roles.includes(role));
});

const roleLabel = computed(() => {
  const role = String(user.value?.role_code || "");
  if (role === "P1") return "P1 最高权限";
  if (role === "T1") return "T1 督导教师";
  if (role === "P2") return "P2 值班经理";
  if (role === "P3") return "P3 实训学生";
  return "未登录";
});

const handleLogout = () => {
  logout();
  router.replace("/login");
};
</script>

<template>
  <div class="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
    <div class="mx-auto flex max-w-[92rem] gap-5 px-4 py-5 lg:px-6">
      <aside class="panel-card hidden w-[19rem] shrink-0 p-4 lg:block">
        <div class="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
          <p class="text-xs font-extrabold tracking-[0.16em] text-[var(--muted)]">OpsMaster Training</p>
          <h1 class="mt-2 text-lg font-extrabold leading-tight">学生实训内容平台</h1>
          <p class="mt-3 text-sm text-[var(--muted)]">
            专业、简洁、学术化。用于项目制课程与实训基地。
          </p>
        </div>

        <div class="mt-4 space-y-2">
          <div class="flex flex-wrap gap-2">
            <span class="tag-pill" v-if="user">{{ user.name || user.username }}</span>
            <span class="tag-pill">{{ roleLabel }}</span>
          </div>
          <nav class="mt-3 grid gap-2">
            <RouterLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-bold text-[var(--ink)] transition hover:bg-[var(--surface-soft)]"
              :class="route.path.startsWith(item.to) ? 'shadow-[var(--shadow-sm)] ring-1 ring-emerald-200' : ''"
            >
              {{ item.label }}
            </RouterLink>
          </nav>
        </div>

        <button
          v-if="user"
          type="button"
          class="btn btn-secondary mt-5 w-full"
          @click="handleLogout"
        >
          退出登录
        </button>
      </aside>

      <main class="min-w-0 flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>

