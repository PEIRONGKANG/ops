import { pb, getUser, isAuthed } from "../api/pocketbase.js";

export function getSession() {
  return {
    user: isAuthed() ? getUser() : null,
  };
}

export async function loginWithPassword(identity, password) {
  // identity can be username/email/student_no depending on PocketBase auth collection settings.
  await pb.collection("users").authWithPassword(identity, password);
  return getSession().user;
}

export function logout() {
  pb.authStore.clear();
}

