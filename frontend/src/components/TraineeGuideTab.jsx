import { useMemo, useState } from "react";

import { HANDBOOK_SECTIONS } from "../training/handbookContent.js";

const CHECK_KEY = "ops_training_handbook_checks_v1";

function loadChecks() {
  try {
    return JSON.parse(localStorage.getItem(CHECK_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveChecks(value) {
  try {
    localStorage.setItem(CHECK_KEY, JSON.stringify(value || {}));
  } catch {
    // ignore
  }
}

function contains(text, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return String(text || "").toLowerCase().includes(q);
}

function countChecklistItems(section) {
  return (section?.blocks || [])
    .filter((b) => b.kind === "checklist")
    .reduce((sum, b) => sum + (Array.isArray(b.items) ? b.items.length : 0), 0);
}

export function TraineeGuideTab() {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set(["mission"]));
  const [checks, setChecks] = useState(() => loadChecks());

  const filtered = useMemo(() => {
    return HANDBOOK_SECTIONS
      .map((section) => {
        const blocks = (section.blocks || []).filter((block) => {
          if (contains(section.title, query) || contains(section.summary, query) || contains(block.title, query)) return true;
          if (block.kind === "text") return contains(block.content, query);
          if (block.kind === "cards") return (block.cards || []).some((c) => contains(c.title, query) || contains(c.content, query));
          if (block.kind === "table") return (block.rows || []).some((row) => row.some((cell) => contains(cell, query)));
          if (block.kind === "phrases") return (block.phrases || []).some((p) => contains(p.label, query) || contains(p.text, query));
          if (block.kind === "checklist") return (block.items || []).some((i) => contains(i, query));
          return false;
        });
        return blocks.length ? { ...section, blocks } : null;
      })
      .filter(Boolean);
  }, [query]);

  const progress = useMemo(() => {
    const total = HANDBOOK_SECTIONS.reduce((sum, s) => sum + countChecklistItems(s), 0);
    const checked = Object.values(checks || {}).filter(Boolean).length;
    const pct = total ? Math.min(100, Math.round((checked / total) * 100)) : 0;
    return { total, checked, pct };
  }, [checks]);

  const toggleSection = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCheck = (key) => {
    setChecks((prev) => {
      const next = { ...(prev || {}) };
      next[key] = !next[key];
      saveChecks(next);
      return next;
    });
  };

  return (
    <section className="module-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="module-kicker">Trainee Handbook</p>
          <h2 className="section-title mt-2">基地学员岗位说明</h2>
          <p className="status-line mt-3">可搜索、可勾选、自查进度自动保存（本机）。</p>
        </div>
        <div className="soft-card w-full max-w-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">阅读/自查进度</div>
            <div className="pill-chip">{progress.pct}%</div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.pct}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-500">{progress.checked} / {progress.total} 已勾选</div>
        </div>
      </div>

      <div className="soft-card mt-4">
        <label className="field-label">搜索</label>
        <input className="field-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例如：个人信息、电话、应急、交接…" />
      </div>

      <div className="mt-4 space-y-4">
        {filtered.map((section) => {
          const isOpen = openIds.has(section.id);
          return (
            <article key={section.id} className="soft-card">
              <button className="w-full text-left" type="button" onClick={() => toggleSection(section.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="panel-title">{section.title}</h3>
                    <p className="status-line mt-2">{section.summary}</p>
                  </div>
                  <span className="pill-chip">{isOpen ? "收起" : "展开"}</span>
                </div>
              </button>

              {isOpen ? (
                <div className="mt-4 space-y-4">
                  {(section.blocks || []).map((block, idx) => {
                    const keyBase = `${section.id}:${idx}`;
                    if (block.kind === "text") {
                      return (
                        <div key={keyBase} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="font-semibold text-slate-900">{block.title}</div>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{block.content}</div>
                        </div>
                      );
                    }
                    if (block.kind === "cards") {
                      return (
                        <div key={keyBase}>
                          <div className="font-semibold text-slate-900">{block.title}</div>
                          <div className="mt-3 grid gap-3 lg:grid-cols-3">
                            {(block.cards || []).map((card) => (
                              <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-sm font-semibold text-slate-900">{card.title}</div>
                                <div className="mt-2 text-sm text-slate-700">{card.content}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (block.kind === "table") {
                      return (
                        <div key={keyBase}>
                          <div className="font-semibold text-slate-900">{block.title}</div>
                          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="min-w-[42rem] w-full text-sm">
                              <thead className="bg-slate-50 text-slate-700">
                                <tr>
                                  {(block.headers || []).map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}
                                </tr>
                              </thead>
                              <tbody className="bg-white">
                                {(block.rows || []).map((row, ridx) => (
                                  <tr key={ridx} className="border-t border-slate-100">
                                    {row.map((cell, cidx) => <td key={cidx} className="px-3 py-2 text-slate-700">{cell}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    }
                    if (block.kind === "phrases") {
                      return (
                        <div key={keyBase}>
                          <div className="font-semibold text-slate-900">{block.title}</div>
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {(block.phrases || []).map((p) => (
                              <button
                                key={p.label}
                                type="button"
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                                onClick={() => navigator.clipboard?.writeText?.(p.text)}
                              >
                                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{p.label}</div>
                                <div className="mt-2 text-sm text-slate-800">{p.text}</div>
                                <div className="mt-2 text-xs text-slate-500">点击复制</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (block.kind === "checklist") {
                      return (
                        <div key={keyBase}>
                          <div className="font-semibold text-slate-900">{block.title}</div>
                          <div className="mt-3 space-y-2">
                            {(block.items || []).map((item, i) => {
                              const key = `${section.id}:${block.title}:${i}`;
                              const checked = Boolean(checks[key]);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  className={checked ? "status-line border-emerald-200 bg-emerald-50 text-emerald-800" : "status-line"}
                                  onClick={() => toggleCheck(key)}
                                >
                                  {checked ? "已完成：" : "待完成："}{item}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

