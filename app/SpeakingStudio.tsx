"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Entry = { id: number; part: number; topic: string; question: string; keywords: string; fullAnswer: string; expressions: string; reviewNotes: string };
type Parsed = Omit<Entry, "id"> & { rawText: string };
const presets = { 1: [{ label: "Part 1 连续问答", seconds: 300 }], 2: [{ label: "准备与笔记", seconds: 60 }, { label: "正式作答", seconds: 120 }], 3: [{ label: "Part 3 深入讨论", seconds: 300 }] } as const;
const formatTime = (value: number) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
const sample = `Part：2
主题：A useful object
问题：Describe an object you use every day.
六组关键词：
1. daily routine
2. practical and reliable
3. save a great deal of time
完整答案：
Paste the polished full answer here.
好表达：
come in handy\nI rely on it on a daily basis
改进提醒：
过去时要保持一致；结尾补充个人感受。`;

function parseImport(rawText: string): Parsed {
  const labels: Record<string, keyof Parsed> = { part: "part", "主题": "topic", topic: "topic", "问题": "question", question: "question", "六组关键词": "keywords", "关键词": "keywords", keywords: "keywords", "完整答案": "fullAnswer", "full answer": "fullAnswer", "好表达": "expressions", expressions: "expressions", "改进提醒": "reviewNotes", "复盘": "reviewNotes", corrections: "reviewNotes" };
  const result: Parsed = { part: 1, topic: "", question: "", keywords: "", fullAnswer: "", expressions: "", reviewNotes: "", rawText };
  let current: keyof Parsed | null = null;
  for (const line of rawText.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:#{1,4}\s*)?([^：:]+)[：:]\s*(.*)$/);
    const key = match ? labels[match[1].trim().toLowerCase()] : null;
    if (key) { current = key; const value = match?.[2]?.trim() || ""; if (key === "part") result.part = Number(value.match(/[123]/)?.[0] || 1); else if (value) result[key] = value; continue; }
    if (current && current !== "part" && line.trim()) result[current] = `${result[current]}${result[current] ? "\n" : ""}${line.trim()}`;
  }
  if (!result.topic || !result.question) throw new Error("至少需要“主题：”和“问题：”两个标题。");
  return result;
}

export default function SpeakingStudio({ hidden, onChanged }: { hidden?: boolean; onChanged?: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]); const [part, setPart] = useState<1 | 2 | 3>(2); const [phase, setPhase] = useState(0); const [remaining, setRemaining] = useState(60); const [running, setRunning] = useState(false);
  const [raw, setRaw] = useState(sample); const [message, setMessage] = useState("粘贴带标题的总结，就能自动拆到对应字段。"); const [search, setSearch] = useState(""); const [filter, setFilter] = useState<"all" | "1" | "2" | "3">("all");
  const audioRef = useRef<AudioContext | null>(null);
  async function load() { const response = await fetch("/api/speaking", { cache: "no-store" }); const data = await response.json() as { entries?: Entry[] }; if (response.ok) setEntries(data.entries || []); }
  useEffect(() => { void load(); }, []);
  function chime() { const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!Ctx) return; const ctx = audioRef.current || new Ctx(); audioRef.current = ctx; const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.frequency.value = 720; gain.gain.setValueAtTime(.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .25); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .26); }
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setRemaining((value) => { if (value > 1) return value - 1; chime(); const next = phase + 1; if (next < presets[part].length) { setPhase(next); return presets[part][next].seconds; } setRunning(false); return 0; }), 1000); return () => clearInterval(timer); }, [running, phase, part]);
  function choosePart(value: 1 | 2 | 3) { setPart(value); setPhase(0); setRemaining(presets[value][0].seconds); setRunning(false); }
  function reset() { setPhase(0); setRemaining(presets[part][0].seconds); setRunning(false); }
  async function importEntry() { try { const parsed = parseImport(raw); const response = await fetch("/api/speaking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) }); const data = await response.json() as { entry?: Entry; error?: string }; if (!response.ok || !data.entry) throw new Error(data.error || "保存失败"); setEntries((current) => [data.entry!, ...current]); setMessage(`已归档到 ${data.entry.topic} · Part ${data.entry.part}`); onChanged?.(); } catch (error) { setMessage(error instanceof Error ? error.message : "无法识别这段总结"); } }
  async function remove(id: number) { if (!window.confirm("删除这份口语语料？")) return; if ((await fetch(`/api/speaking?id=${id}`, { method: "DELETE" })).ok) { setEntries((current) => current.filter((item) => item.id !== id)); onChanged?.(); } }
  const visible = useMemo(() => entries.filter((entry) => (filter === "all" || entry.part === Number(filter)) && `${entry.topic} ${entry.question} ${entry.keywords} ${entry.expressions}`.toLowerCase().includes(search.toLowerCase())), [entries, filter, search]);
  const current = presets[part][phase];
  return <section className="tool-stage speaking-stage" hidden={hidden}>
    <div className="module-heading"><div><p className="eyebrow">IELTS SPEAKING</p><h2>口语练习 · 限时输出与语料沉淀</h2></div><p>计时练习负责“说出来”，语料档案负责“下次说得更好”。</p></div>
    <div className="speaking-top"><article className="speaking-timer"><div className="part-switch">{([1, 2, 3] as const).map((value) => <button className={part === value ? "active" : ""} onClick={() => choosePart(value)} key={value}>Part {value}</button>)}</div><p>{current.label}</p><strong>{formatTime(remaining)}</strong><div className="phase-dots">{presets[part].map((item, index) => <span className={index === phase ? "active" : index < phase ? "done" : ""} key={item.label}>{item.label} · {item.seconds / 60} 分钟</span>)}</div><div className="timer-controls"><button className="primary-button" onClick={() => setRunning((value) => !value)}>{running ? "暂停" : remaining === 0 ? "已完成" : "开始"}</button><button className="secondary-button" onClick={reset}>重置</button></div><small>Part 2 会在 1 分钟准备结束后，自动进入 2 分钟作答。</small></article>
      <article className="corpus-import"><div><p className="eyebrow">SMART IMPORT</p><h3>粘贴一次，自动分类</h3></div><textarea value={raw} onChange={(event) => setRaw(event.target.value)} /><button className="primary-button" onClick={() => void importEntry()}>识别并保存到语料档案</button><p className="inline-message">{message}</p></article></div>
    <div className="corpus-library"><div className="library-tools"><div><p className="eyebrow">SPEAKING LIBRARY</p><h3>口语语料档案 <span>{visible.length}</span></h3></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索主题、问题、表达…" /><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">全部 Part</option><option value="1">Part 1</option><option value="2">Part 2</option><option value="3">Part 3</option></select></div>
      <div className="corpus-list">{visible.length ? visible.map((entry) => <details className="corpus-card" key={entry.id}><summary><span>Part {entry.part}</span><div><small>{entry.topic}</small><strong>{entry.question}</strong></div><i>展开</i></summary><div className="corpus-content">{entry.keywords && <section><h4>六组关键词</h4><p className="preserve-lines">{entry.keywords}</p></section>}{entry.fullAnswer && <section className="full-answer"><h4>完整答案</h4><p className="preserve-lines">{entry.fullAnswer}</p></section>}{entry.expressions && <section><h4>好表达</h4><p className="preserve-lines">{entry.expressions}</p></section>}{entry.reviewNotes && <section><h4>改进提醒</h4><p className="preserve-lines">{entry.reviewNotes}</p></section>}<button className="danger-link" onClick={() => void remove(entry.id)}>删除这份语料</button></div></details>) : <div className="compact-empty">第一份总结保存后，会按主题和 Part 出现在这里。</div>}</div>
    </div>
  </section>;
}
