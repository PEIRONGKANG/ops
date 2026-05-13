import PocketBase from "pocketbase";

function normalizePocketBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "/pb";
  return raw.endsWith("/pb") || raw.includes(":8090") ? raw : `${raw}/pb`;
}

// Default to same-origin proxy path in production. In local dev, set VITE_PB_URL=http://127.0.0.1:8090.
const PB_URL = normalizePocketBaseUrl(import.meta.env?.VITE_POCKETBASE_URL || import.meta.env?.VITE_PB_URL);

export const pb = new PocketBase(PB_URL);

// Keep auth state across reloads.
pb.autoCancellation(false);

export function getUser() {
  return pb.authStore.model || null;
}

export function isAuthed() {
  return pb.authStore.isValid;
}
