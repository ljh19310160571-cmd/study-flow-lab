"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Todo = { id: number; title: string; kind: "branch" | "idea" | "fix"; area: "general" | "listening" | "speaking" | "topik" | "project"; completed: boolean; createdAt: string };
const kindLabels = { branch: "分支任务", idea: "小巧思", fix: "待完善" };
const areaLabels = { general: "通用", listening: "雅思听力", speaking: "雅思口语", topik: "TOPIK", project: "前端项目" };

export default function TodoBoard({ hidden, onChanged }: { hidden?: boolean; onChanged?: () => void }) {
  const [items, setItems] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Todo["kind"]>("branch");
  const [area, setArea] = useState<Todo["area"]>("general");
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editKind, setEditKind] = useState<Todo["kind"]>("branch");
  const [editArea, setEditArea] = useState<Todo["area"]>("general");
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    const response = await fetch("/api/todos", { cache: "no-store" });
    const data = await response.json() as { items?: Todo[] };
    if (response.ok) setItems(data.items || []);
  }
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => items.filter((item) => filter === "all" || (filter === "done" ? item.completed : !item.completed)), [items, filter]);

  async function add(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, kind, area }) });
    const data = await response.json() as { item?: Todo; error?: string };
    if (!response.ok || !data.item) return setMessage(data.error || "保存失败");
    setItems((current) => [data.item!, ...current]); setTitle(""); setMessage("已记下，不用再分心记着它。"); onChanged?.();
  }
  async function toggle(item: Todo) {
    const response = await fetch("/api/todos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, completed: !item.completed }) });
    const data = await response.json() as { item?: Todo };
    if (data.item) { setItems((current) => current.map((row) => row.id === item.id ? data.item! : row)); onChanged?.(); }
  }
  async function remove(id: number) {
    if (!window.confirm("删除这条待办？")) return;
    if ((await fetch(`/api/todos?id=${id}`, { method: "DELETE" })).ok) { setItems((current) => current.filter((item) => item.id !== id)); onChanged?.(); }
  }

  function beginEdit(item: Todo) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditKind(item.kind);
    setEditArea(item.area);
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (editingId === null || !editTitle.trim()) return setMessage("待办内容不能为空。");
    setSavingEdit(true);
    const response = await fetch("/api/todos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, title: editTitle, kind: editKind, area: editArea }),
    });
    const data = await response.json() as { item?: Todo; error?: string };
    setSavingEdit(false);
    if (!response.ok || !data.item) return setMessage(data.error || "修改失败");
    setItems((current) => current.map((item) => item.id === editingId ? data.item! : item));
    cancelEdit();
    setMessage("待办内容已更新。");
    onChanged?.();
  }

  return <section className="tool-stage todo-stage" hidden={hidden}>
    <div className="module-heading"><div><p className="eyebrow">QUICK CAPTURE</p><h2>To Do · 先记下，再回到主线</h2></div><p>学习中冒出的支线、想法和待修改内容，都先放这里。</p></div>
    <form className="todo-capture" onSubmit={add}>
      <label className="todo-title"><span>现在别做，只写一句</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：给计时器增加本周统计" /></label>
      <label><span>类型</span><select value={kind} onChange={(event) => setKind(event.target.value as Todo["kind"])}>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label><span>归属</span><select value={area} onChange={(event) => setArea(event.target.value as Todo["area"])}>{Object.entries(areaLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <button className="primary-button">记下来</button>
    </form>
    {message && <p className="inline-message">{message}</p>}
    <div className="subtabs"><button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>待处理 {items.filter((item) => !item.completed).length}</button><button className={filter === "done" ? "active" : ""} onClick={() => setFilter("done")}>已完成</button><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部</button></div>
    <div className="todo-list">{visible.length ? visible.map((item) => <article className={item.completed ? "todo-item done" : "todo-item"} key={item.id}>
      <button className="todo-check" onClick={() => void toggle(item)} aria-label={item.completed ? "恢复待办" : "完成待办"}>{item.completed ? "✓" : ""}</button>
      <div><h3>{item.title}</h3><p><span>{kindLabels[item.kind]}</span><span>{areaLabels[item.area]}</span></p></div>
      <div className="todo-item-actions"><button type="button" onClick={() => beginEdit(item)}>修改</button><button className="danger-link" type="button" onClick={() => void remove(item.id)}>删除</button></div>
      {editingId === item.id && <form className="todo-edit-form" onSubmit={saveEdit}>
        <label className="todo-title"><span>待办内容</span><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} autoFocus /></label>
        <label><span>类型</span><select value={editKind} onChange={(event) => setEditKind(event.target.value as Todo["kind"])}>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label><span>归属</span><select value={editArea} onChange={(event) => setEditArea(event.target.value as Todo["area"])}>{Object.entries(areaLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <div className="record-edit-actions"><button className="primary-button" disabled={savingEdit}>{savingEdit ? "保存中…" : "保存修改"}</button><button className="secondary-button" type="button" onClick={cancelEdit}>取消</button></div>
      </form>}
    </article>) : <div className="compact-empty">这里已经清空，可以专心做主线任务。</div>}</div>
  </section>;
}
