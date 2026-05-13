import { useMemo, useState } from "react";

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  const str = String(value || "").trim();
  return str ? [str] : [];
}

function arraysEqualIgnoreOrder(a, b) {
  const aa = [...a].sort();
  const bb = [...b].sort();
  if (aa.length !== bb.length) return false;
  return aa.every((v, i) => v === bb[i]);
}

export function InteractiveExercise({ exercise, onSubmit, disabled }) {
  const type = String(exercise?.type || "").trim();
  const options = Array.isArray(exercise?.options) ? exercise.options : [];
  const maxScore = Number(exercise?.score || 0);

  const [selected, setSelected] = useState([]);
  const [textValue, setTextValue] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const submittedAnswer = useMemo(() => {
    if (type === "text_input" || type === "short_answer") return textValue;
    if (type === "single_choice") return selected[0] || "";
    if (type === "multiple_choice") return selected;
    return null;
  }, [selected, textValue, type]);

  const canSubmit = !disabled && !busy && (() => {
    if (type === "text_input" || type === "short_answer") return Boolean(textValue.trim());
    if (type === "single_choice") return Boolean(selected[0]);
    if (type === "multiple_choice") return selected.length > 0;
    return false;
  })();

  const toggleOption = (label) => {
    if (disabled || busy) return;
    const key = String(label || "").trim();
    if (!key) return;
    if (type === "single_choice") {
      setSelected([key]);
      return;
    }
    setSelected((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setResult(null);
    try {
      const serverResult = await onSubmit?.(submittedAnswer);
      setResult(serverResult || null);
    } finally {
      setBusy(false);
    }
  };

  // Local fallback grading when server result is absent.
  const localPreview = useMemo(() => {
    const answer = exercise?.answer;
    if (!answer) return null;
    if (type === "single_choice" || type === "multiple_choice") {
      const expected = normalizeArray(answer);
      const got = type === "single_choice" ? normalizeArray(selected[0]) : normalizeArray(selected);
      const ok = arraysEqualIgnoreOrder(expected, got);
      return { isCorrect: ok, score: ok ? maxScore : 0 };
    }
    if (type === "text_input" || type === "short_answer") {
      const ok = String(textValue || "").trim().toLowerCase() === String(answer || "").trim().toLowerCase();
      return { isCorrect: ok, score: ok ? maxScore : 0 };
    }
    return null;
  }, [exercise, maxScore, selected, textValue, type]);

  const finalResult = result?.graded || result || null;
  const display = finalResult || localPreview;

  return (
    <div className="soft-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="module-kicker">Interactive Exercise</p>
          <h3 className="panel-title mt-2">{exercise?.question || "练习题"}</h3>
        </div>
        <span className="pill-chip">{maxScore ? `${maxScore} 分` : "练习"}</span>
      </div>

      {type === "text_input" || type === "short_answer" ? (
        <div className="mt-4">
          <label className="field-label">你的回答</label>
          <input
            className="field-input"
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            disabled={disabled || busy}
            placeholder="输入答案后提交"
          />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {options.map((opt) => {
            const label = String(opt?.label || "").trim();
            const checked = selected.includes(label);
            return (
              <button
                key={label}
                type="button"
                className={checked ? "btn-secondary border-emerald-300 bg-emerald-50 text-emerald-800" : "btn-secondary"}
                onClick={() => toggleOption(label)}
                disabled={disabled || busy}
              >
                <strong className="mr-2">{label}</strong>
                <span className="opacity-80">{opt?.text || ""}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {busy ? "提交中..." : "提交练习"}
        </button>
        {display ? (
          <span className={`status-pill ${display.isCorrect ? "is-good" : "is-warn"}`}>
            {display.isCorrect ? "正确" : "不正确"} · {display.score ?? 0} 分
          </span>
        ) : null}
      </div>

      {finalResult?.explanation ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="font-semibold">解析</div>
          <div className="mt-1 whitespace-pre-wrap">{finalResult.explanation}</div>
        </div>
      ) : null}
    </div>
  );
}
