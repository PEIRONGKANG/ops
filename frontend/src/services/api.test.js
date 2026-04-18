import assert from "node:assert/strict";
import test from "node:test";

import { request } from "./api.js";

test("request aborts stalled calls with a timeout error", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (_url, options = {}) => new Promise((_, reject) => {
    options.signal?.addEventListener(
      "abort",
      () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      { once: true },
    );
  });

  try {
    await assert.rejects(
      request("/slow", { timeoutMs: 5 }),
      /请求超时，请检查网络后重试。/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
