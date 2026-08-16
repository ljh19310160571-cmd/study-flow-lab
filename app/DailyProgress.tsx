"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Entry = { id: number; date: string; category: "listening" | "speaking" | "topik" | "project" | "other"; title: string; quantity: number; unit: string; durationMinutes: number; notes: string; source: string };
type Review = { id: number; date: string; content: string };
const categories = { listening: "雅思听力", speaking: "雅思口语", topik: "TOPIK", project: "前端项目", other: "其他" };
const localDate = () => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export default function DailyProgress({ hidden, onChanged }: { hidden?: boolean; onChanged?: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]); const [reviews, setReviews] = useState<Review[]>([]);
  const [date, setDate] = useState(localDate); const [category, setCategory] = useState<Entry["category"]>("listening");
  const [title, setTitle] = useState(""); const [quantity, setQuantity] = useState(0); const [unit, setUnit] = useState(""); const [minutes, setMinutes] = useState(20); const [notes, setNotes] = useState("");
  const [review, setReview] = useState(""); const [message, setMessage] = useState("");
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null); const [savingEdit, setSavingEdit] = useState(false);
  async function load() { const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10); const response = await fetch(`/api/daily?since=${since}`, { cache: "no-store" }); const data = await response.json() as { entries?: Entry[]; reviews?: Review[] }; if (response.ok) { setEntries(data.entries || []); setReviews(data.reviews || []); } }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!hidden) void load(); }, [hidden]);
  useEffect(() => { setReview(reviews.find((item) => item.date === date)?.content || ""); }, [date, reviews]);
  const selected = useMemo(() => entries.filter((item) => item.date === date), [entries, date]);
  const totalMinutes = selected.reduce((sum, item) => sum + item.durationMinutes, 0);
  const week = useMemo(() => Array.from({ length: 7 }, (_, offset) => { const d = new Date(); d.setDate(d.getDate() - (6 - offset)); const key = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); const rows = entries.filter((item) => item.date === key); return { key, label: `${d.getMonth() + 1}/${d.getDate()}`, count: rows.length, minutes: rows.reduce((sum, row) => sum + row.durationMinutes, 0) }; }), [entries]);
  const maxMinutes = Math.max(1, ...week.map((item) => item.minutes));
  function selectChartDate(nextDate: string) { setDate(nextDate); setEditingEntry(null); setMessage(""); }
  async function add(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, category, title, quantity, unit, durationMinutes: minutes, notes }) }); const data = await response.json() as { entry?: Entry; error?: string }; if (!response.ok || !data.entry) return setMessage(data.error || "保存失败"); setEntries((current) => [data.entry!, ...current]); setTitle(""); setQuantity(0); setUnit(""); setNotes(""); setMessage("今天的行动已记入档案。"); onChanged?.(); }
  async function saveReview() { const response = await fetch("/api/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "review", date, content: review }) }); const data = await response.json() as { review?: Review }; if (data.review) { setReviews((current) => [data.review!, ...current.filter((item) => item.date !== date)]); setMessage("复盘已保存。"); } }
  async function remove(id: number) { if ((await fetch(`/api/daily?id=${id}`, { method: "DELETE" })).ok) { setEntries((current) => current.filter((item) => item.id !== id)); onChanged?.(); } }
  function beginEdit(item: Entry) { setEditingEntry({ ...item }); setMessage(""); }
  async function saveEntryEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingEntry || !editingEntry.title.trim()) return setMessage("请写下完成了什么。");
    setSavingEdit(true);
    const response = await fetch("/api/daily", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingEntry) });
    const data = await response.json() as { entry?: Entry; error?: string };
    setSavingEdit(false);
    if (!response.ok || !data.entry) return setMessage(data.error || "修改失败");
    setEntries((current) => current.map((item) => item.id === data.entry!.id ? data.entry! : item));
    setEditingEntry(null);
    setMessage("行动记录已更新。");
    onChanged?.();
  }
  return <section className="tool-stage daily-stage" hidden={hidden}>
    <div className="module-heading"><div><p className="eyebrow">DAILY ACTION</p><h2>行动记录 · 看得见的积累</h2></div><input className="date-control" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
    <div className="daily-summary"><article><span>完成任务</span><strong>{selected.length}</strong><small>项</small></article><article><span>实际投入</span><strong>{totalMinutes}</strong><small>分钟</small></article><article><span>有量化成果</span><strong>{selected.filter((item) => item.quantity > 0).length}</strong><small>项</small></article></div>
    <div className="daily-grid"><div className="daily-main">
      <form className="action-form" onSubmit={add}><h3>补记一项完成</h3><div className="action-form-grid"><label><span>类别</span><select value={category} onChange={(event) => setCategory(event.target.value as Entry["category"])}>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="wide"><span>完成了什么</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="完成一套听力 / 背单词" /></label><label><span>数量</span><input type="number" min="0" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><label><span>单位</span><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="个 / 套 / 页" /></label><label><span>用时（分钟）</span><input type="number" min="0" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label><label className="wide"><span>补充说明</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="今天的状态或成果" /></label></div><button className="primary-button">加入今日行动</button></form>
      <div className="action-list"><h3>{date === localDate() ? "今天已完成" : `${date} 已完成`}</h3>{selected.length ? selected.map((item) => <article key={item.id}><div><span>{categories[item.category]}</span><h4>{item.title}</h4><p>{item.quantity > 0 && `${item.quantity}${item.unit || "个"} · `}{item.durationMinutes} 分钟{item.source === "timer" ? " · 来自计时器" : ""}</p></div><div className="action-item-actions"><button type="button" onClick={() => beginEdit(item)}>修改</button><button className="danger-link" type="button" onClick={() => void remove(item.id)}>删除</button></div>{editingEntry?.id === item.id && <form className="action-edit-form" onSubmit={saveEntryEdit}>
        <div className="action-edit-grid">
          <label><span>日期</span><input type="date" value={editingEntry.date} onChange={(event) => setEditingEntry({ ...editingEntry, date: event.target.value })} /></label>
          <label><span>类别</span><select value={editingEntry.category} onChange={(event) => setEditingEntry({ ...editingEntry, category: event.target.value as Entry["category"] })}>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="wide"><span>完成了什么</span><input value={editingEntry.title} onChange={(event) => setEditingEntry({ ...editingEntry, title: event.target.value })} autoFocus /></label>
          <label><span>数量</span><input type="number" min="0" value={editingEntry.quantity} onChange={(event) => setEditingEntry({ ...editingEntry, quantity: Number(event.target.value) })} /></label>
          <label><span>单位</span><input value={editingEntry.unit} onChange={(event) => setEditingEntry({ ...editingEntry, unit: event.target.value })} /></label>
          <label><span>用时（分钟）</span><input type="number" min="0" value={editingEntry.durationMinutes} onChange={(event) => setEditingEntry({ ...editingEntry, durationMinutes: Number(event.target.value) })} /></label>
          <label className="wide"><span>补充说明</span><input value={editingEntry.notes} onChange={(event) => setEditingEntry({ ...editingEntry, notes: event.target.value })} /></label>
        </div>
        <div className="record-edit-actions"><button className="primary-button" disabled={savingEdit}>{savingEdit ? "保存中…" : "保存修改"}</button><button className="secondary-button" type="button" onClick={() => setEditingEntry(null)}>取消</button></div>
      </form>}</article>) : <div className="compact-empty">完成第一项后，就从这里开始累计。</div>}</div>
    </div><aside className="daily-side"><div className="week-chart"><h3>近 7 天投入</h3><div className="bars">{week.map((item) => <button className={date === item.key ? "active" : ""} type="button" key={item.key} onClick={() => selectChartDate(item.key)} aria-label={`${item.label}，投入 ${item.minutes} 分钟，完成 ${item.count} 项；查看当天记录`} aria-pressed={date === item.key} title={`查看 ${item.label} 的行动记录`}><span>{item.minutes || ""}</span><i style={{ height: `${Math.max(5, item.minutes / maxMinutes * 100)}%` }} /><small>{item.label}</small></button>)}</div></div><div className="review-box"><h3>当天复盘</h3><textarea value={review} onChange={(event) => setReview(event.target.value)} placeholder="今天做得好的、卡住的、明天最先做的……" /><button className="secondary-button" onClick={() => void saveReview()}>保存复盘</button></div></aside></div>
    {message && <p className="inline-message">{message}</p>}
  </section>;
}
