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
  async function load() { const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10); const response = await fetch(`/api/daily?since=${since}`, { cache: "no-store" }); const data = await response.json() as { entries?: Entry[]; reviews?: Review[] }; if (response.ok) { setEntries(data.entries || []); setReviews(data.reviews || []); } }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!hidden) void load(); }, [hidden]);
  useEffect(() => { setReview(reviews.find((item) => item.date === date)?.content || ""); }, [date, reviews]);
  const selected = useMemo(() => entries.filter((item) => item.date === date), [entries, date]);
  const totalMinutes = selected.reduce((sum, item) => sum + item.durationMinutes, 0);
  const week = useMemo(() => Array.from({ length: 7 }, (_, offset) => { const d = new Date(); d.setDate(d.getDate() - (6 - offset)); const key = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); const rows = entries.filter((item) => item.date === key); return { key, label: `${d.getMonth() + 1}/${d.getDate()}`, count: rows.length, minutes: rows.reduce((sum, row) => sum + row.durationMinutes, 0) }; }), [entries]);
  const maxMinutes = Math.max(1, ...week.map((item) => item.minutes));
  async function add(event: FormEvent) { event.preventDefault(); const response = await fetch("/api/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, category, title, quantity, unit, durationMinutes: minutes, notes }) }); const data = await response.json() as { entry?: Entry; error?: string }; if (!response.ok || !data.entry) return setMessage(data.error || "保存失败"); setEntries((current) => [data.entry!, ...current]); setTitle(""); setQuantity(0); setUnit(""); setNotes(""); setMessage("今天的行动已记入档案。"); onChanged?.(); }
  async function saveReview() { const response = await fetch("/api/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "review", date, content: review }) }); const data = await response.json() as { review?: Review }; if (data.review) { setReviews((current) => [data.review!, ...current.filter((item) => item.date !== date)]); setMessage("复盘已保存。"); } }
  async function remove(id: number) { if ((await fetch(`/api/daily?id=${id}`, { method: "DELETE" })).ok) { setEntries((current) => current.filter((item) => item.id !== id)); onChanged?.(); } }
  return <section className="tool-stage" hidden={hidden}>
    <div className="module-heading"><div><p className="eyebrow">DAILY ACTION</p><h2>行动记录 · 看得见的积累</h2></div><input className="date-control" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
    <div className="daily-summary"><article><span>完成任务</span><strong>{selected.length}</strong><small>项</small></article><article><span>实际投入</span><strong>{totalMinutes}</strong><small>分钟</small></article><article><span>有量化成果</span><strong>{selected.filter((item) => item.quantity > 0).length}</strong><small>项</small></article></div>
    <div className="daily-grid"><div className="daily-main">
      <form className="action-form" onSubmit={add}><h3>补记一项完成</h3><div className="action-form-grid"><label><span>类别</span><select value={category} onChange={(event) => setCategory(event.target.value as Entry["category"])}>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="wide"><span>完成了什么</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="完成一套听力 / 背单词" /></label><label><span>数量</span><input type="number" min="0" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><label><span>单位</span><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="个 / 套 / 页" /></label><label><span>用时（分钟）</span><input type="number" min="0" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label><label className="wide"><span>补充说明</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="今天的状态或成果" /></label></div><button className="primary-button">加入今日行动</button></form>
      <div className="action-list"><h3>{date === localDate() ? "今天已完成" : `${date} 已完成`}</h3>{selected.length ? selected.map((item) => <article key={item.id}><div><span>{categories[item.category]}</span><h4>{item.title}</h4><p>{item.quantity > 0 && `${item.quantity}${item.unit || "个"} · `}{item.durationMinutes} 分钟{item.source === "timer" ? " · 来自计时器" : ""}</p></div><button onClick={() => void remove(item.id)}>删除</button></article>) : <div className="compact-empty">完成第一项后，就从这里开始累计。</div>}</div>
    </div><aside className="daily-side"><div className="week-chart"><h3>近 7 天投入</h3><div className="bars">{week.map((item) => <div key={item.key}><span>{item.minutes || ""}</span><i style={{ height: `${Math.max(5, item.minutes / maxMinutes * 100)}%` }} /><small>{item.label}</small></div>)}</div></div><div className="review-box"><h3>当天复盘</h3><textarea value={review} onChange={(event) => setReview(event.target.value)} placeholder="今天做得好的、卡住的、明天最先做的……" /><button className="secondary-button" onClick={() => void saveReview()}>保存复盘</button></div></aside></div>
    {message && <p className="inline-message">{message}</p>}
  </section>;
}
