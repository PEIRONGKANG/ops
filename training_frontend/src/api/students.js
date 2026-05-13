import { pb } from "./pocketbase.js";

const COLLECTION = "Students";

export async function getStudents(options = {}) {
  const {
    page = 1,
    perPage = 50,
    sort = "student_no",
    filter = "",
    expand = "",
  } = options;
  return pb.collection(COLLECTION).getList(page, perPage, { sort, filter, expand });
}

export async function getStudentByUserId(userId) {
  const filter = `user_id="${userId}"`;
  const list = await pb.collection(COLLECTION).getList(1, 1, { filter });
  return list.items[0] || null;
}

export async function updateStudentProgress(studentId, patch) {
  return pb.collection(COLLECTION).update(studentId, patch);
}

