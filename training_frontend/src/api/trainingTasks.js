import { pb } from "./pocketbase.js";

const COLLECTION = "Training_Tasks";

export async function getPublishedTasks() {
  return pb.collection(COLLECTION).getFullList({
    sort: "sort_order,created",
    filter: 'status="published"',
  });
}

export async function getAllTasks() {
  return pb.collection(COLLECTION).getFullList({
    sort: "sort_order,created",
  });
}

export async function getTaskById(id) {
  return pb.collection(COLLECTION).getOne(id);
}

export async function createTask(data) {
  return pb.collection(COLLECTION).create(data);
}

export async function updateTask(id, data) {
  return pb.collection(COLLECTION).update(id, data);
}

