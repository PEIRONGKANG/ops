function normalizeString(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeMulti(values) {
  const list = Array.isArray(values) ? values : [];
  return list.map((v) => normalizeString(v)).filter(Boolean).sort();
}

export function gradeExercise(exercise, submittedAnswer) {
  const type = String(exercise?.type || "");
  const scoreValue = Number(exercise?.score ?? exercise?.total_score ?? 0) || 0;

  if (!type) {
    return { isCorrect: false, score: 0, feedback: "题目配置缺失。", explanation: "" };
  }

  if (type === "single_choice") {
    const expected = normalizeMulti(exercise?.answer)[0] || "";
    const actual = normalizeString(submittedAnswer);
    const ok = expected && actual === expected;
    return {
      isCorrect: ok,
      score: ok ? scoreValue : 0,
      feedback: ok ? "回答正确。" : "回答不正确。",
      explanation: String(exercise?.explanation || ""),
    };
  }

  if (type === "multiple_choice") {
    const expected = normalizeMulti(exercise?.answer);
    const actual = normalizeMulti(submittedAnswer);
    const ok = expected.length && expected.join("|") === actual.join("|");
    return {
      isCorrect: ok,
      score: ok ? scoreValue : 0,
      feedback: ok ? "回答正确。" : "回答不正确。",
      explanation: String(exercise?.explanation || ""),
    };
  }

  if (type === "text_input") {
    const expected = normalizeString(Array.isArray(exercise?.answer) ? exercise.answer[0] : exercise?.answer);
    const actual = normalizeString(submittedAnswer);
    const ok = expected && actual === expected;
    return {
      isCorrect: ok,
      score: ok ? scoreValue : 0,
      feedback: ok ? "回答正确。" : "回答不正确。",
      explanation: String(exercise?.explanation || ""),
    };
  }

  return { isCorrect: false, score: 0, feedback: "暂不支持的题型。", explanation: String(exercise?.explanation || "") };
}

