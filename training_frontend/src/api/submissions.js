import { pb } from "./pocketbase.js";

const COLLECTION = "Submissions";

export async function getSubmissionsByStudent(studentId) {
  return pb.collection(COLLECTION).getFullList({
    sort: "-submitted_at, -created",
    filter: `student_id="${studentId}"`,
    expand: "task_id,student_id,reviewed_by",
  });
}

export async function getAllSubmissions(options = {}) {
  const { page = 1, perPage = 50, filter = "", sort = "-submitted_at,-created" } = options;
  return pb.collection(COLLECTION).getList(page, perPage, {
    filter,
    sort,
    expand: "task_id,student_id,reviewed_by",
  });
}

export async function submitExercise({ studentId, taskId, submittedAnswer, graded, actorUserId }) {
  const now = new Date().toISOString();
  const payload = {
    student_id: studentId,
    task_id: taskId,
    submitted_answer: submittedAnswer,
    score: graded.score,
    is_correct: Boolean(graded.isCorrect),
    feedback: graded.feedback || "",
    status: graded.isCorrect ? "completed" : "submitted",
    submitted_at: now,
    reviewed_by: "",
    reviewed_at: "",
    teacher_comment: "",
  };

  // Upsert by student+task: keep one latest record per task.
  const existing = await pb.collection(COLLECTION).getList(1, 1, {
    filter: `student_id="${studentId}" && task_id="${taskId}"`,
  });
  if (existing.items[0]) {
    return pb.collection(COLLECTION).update(existing.items[0].id, payload);
  }
  return pb.collection(COLLECTION).create(payload);
}

export async function getSubmissionDetail(id) {
  return pb.collection(COLLECTION).getOne(id, { expand: "task_id,student_id,reviewed_by" });
}

export async function reviewSubmission(id, patch) {
  return pb.collection(COLLECTION).update(id, patch);
}

