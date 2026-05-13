import { createRouter, createWebHistory } from "vue-router";

import { getSession } from "../stores/authStore.js";
import LoginPage from "../views/LoginPage.vue";
import StudentTrainingPage from "../views/StudentTrainingPage.vue";
import TeacherDashboardPage from "../views/TeacherDashboardPage.vue";
import TrainingTaskManagementPage from "../views/TrainingTaskManagementPage.vue";
import SubmissionDetailPage from "../views/SubmissionDetailPage.vue";
import HandbookPage from "../views/HandbookPage.vue";

function needsAuth(to) {
  return to.meta?.requiresAuth !== false;
}

function hasRole(user, roles) {
  if (!roles || !roles.length) return true;
  return roles.includes(String(user?.role_code || ""));
}

const router = createRouter({
  history: createWebHistory("/training/"),
  routes: [
    { path: "/login", name: "login", component: LoginPage, meta: { requiresAuth: false } },
    { path: "/", redirect: "/home" },
    { path: "/home", name: "home", component: StudentTrainingPage, meta: { requiresAuth: true } },
    { path: "/teacher", name: "teacher_dashboard", component: TeacherDashboardPage, meta: { requiresAuth: true, roles: ["P1", "T1", "P2"] } },
    { path: "/tasks", name: "tasks_manage", component: TrainingTaskManagementPage, meta: { requiresAuth: true, roles: ["P1", "T1"] } },
    { path: "/submissions/:id", name: "submission_detail", component: SubmissionDetailPage, meta: { requiresAuth: true } },
    { path: "/handbook", name: "handbook", component: HandbookPage, meta: { requiresAuth: true } },
    { path: "/:pathMatch(.*)*", redirect: "/home" },
  ],
});

router.beforeEach((to) => {
  const session = getSession();
  if (!needsAuth(to)) return true;
  if (!session?.user) return { name: "login" };
  if (!hasRole(session.user, to.meta?.roles)) return { name: "home" };
  return true;
});

export default router;

