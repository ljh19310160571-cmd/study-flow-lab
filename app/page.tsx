"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Category = "paraphrase" | "vocabulary" | "sentence";
type Status = "new" | "reviewing" | "mastered";

type ListeningRecord = {
  id: number;
  book: number;
  test: number;
  part: number;
  questionNumber: string;
  category: Category;
  promptExpression: string;
  audioExpression: string;
  phrase: string;
  originalSentence: string;
  contextMeaning: string;
  chunkedSentence: string;
  chineseSummary: string;
  evidence: string;
  notes: string;
  status: Status;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
};

type RecordDraft = Omit<ListeningRecord, "id" | "reviewCount" | "createdAt" | "updatedAt">;

const categoryMeta: Record<Category, { label: string; short: string; hint: string }> = {
  paraphrase: {
    label: "同义替换",
    short: "替",
    hint: "题干 / 选项表达 → 录音中的表达",
  },
  vocabulary: {
    label: "生词词组",
    short: "词",
    hint: "词组＋原句＋此处意思",
  },
  sentence: {
    label: "长句分析",
    short: "句",
    hint: "意群切分＋中文概括＋答案作用",
  },
};

const statusMeta: Record<Status, { label: string; tone: string }> = {
  new: { label: "待复习", tone: "status-new" },
  reviewing: { label: "理解中", tone: "status-reviewing" },
  mastered: { label: "已掌握", tone: "status-mastered" },
};

const emptyDraft: RecordDraft = {
  book: 19,
  test: 2,
  part: 3,
  questionNumber: "",
  category: "paraphrase",
  promptExpression: "",
  audioExpression: "",
  phrase: "",
  originalSentence: "",
  contextMeaning: "",
  chunkedSentence: "",
  chineseSummary: "",
  evidence: "",
  notes: "",
  status: "new",
};

function todayLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

function recordTitle(record: ListeningRecord) {
  if (record.category === "paraphrase") return record.promptExpression || "未填写题干表达";
  if (record.category === "vocabulary") return record.phrase || "未填写词组";
  return record.originalSentence || "未填写长句";
}

function recordAnswer(record: ListeningRecord) {
  if (record.category === "paraphrase") return record.audioExpression;
  if (record.category === "vocabulary") return record.contextMeaning;
  return record.chineseSummary;
}

export default function Home() {
  const [records, setRecords] = useState<ListeningRecord[]>([]);
  const [draft, setDraft] = useState<RecordDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"records" | "review">("records");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [bookFilter, setBookFilter] = useState("all");
  const [testFilter, setTestFilter] = useState("all");
  const [partFilter, setPartFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    void loadRecords();
  }, []);

  async function loadRecords() {
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      const payload = (await response.json()) as { records?: ListeningRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "读取失败");
      setRecords(payload.records || []);
    } catch {
      setMessage("暂时无法连接记录库，请稍后刷新。");
    } finally {
      setLoading(false);
    }
  }

  const filteredRecords = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return records.filter((record) => {
      const haystack = Object.values(record).join(" ").toLowerCase();
      return (
        (!needle || haystack.includes(needle)) &&
        (bookFilter === "all" || record.book === Number(bookFilter)) &&
        (testFilter === "all" || record.test === Number(testFilter)) &&
        (partFilter === "all" || record.part === Number(partFilter)) &&
        (categoryFilter === "all" || record.category === categoryFilter) &&
        (statusFilter === "all" || record.status === statusFilter)
      );
    });
  }, [records, search, bookFilter, testFilter, partFilter, categoryFilter, statusFilter]);

  const reviewRecords = useMemo(
    () => filteredRecords.filter((record) => record.status !== "mastered"),
    [filteredRecords]
  );

  const stats = useMemo(() => {
    const mastered = records.filter((record) => record.status === "mastered").length;
    const partThree = records.filter((record) => record.part === 3 && record.status !== "mastered").length;
    return { total: records.length, mastered, partThree, due: records.length - mastered };
  }, [records]);

  function updateDraft<K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openNew(category: Category = "paraphrase") {
    setEditingId(null);
    setDraft((current) => ({
      ...emptyDraft,
      book: current.book,
      test: current.test,
      part: current.part,
      category,
    }));
    setFormOpen(true);
    setMessage("");
  }

  function openEdit(record: ListeningRecord) {
    const { id, reviewCount, createdAt, updatedAt, ...rest } = record;
    void id;
    void reviewCount;
    void createdAt;
    void updatedAt;
    setDraft(rest);
    setEditingId(record.id);
    setFormOpen(true);
    setMessage("");
  }

  function draftIsValid() {
    if (draft.category === "paraphrase") return draft.promptExpression.trim() && draft.audioExpression.trim();
    if (draft.category === "vocabulary") return draft.phrase.trim() && draft.contextMeaning.trim();
    return draft.originalSentence.trim() && draft.chineseSummary.trim();
  }

  async function submitRecord(event: FormEvent) {
    event.preventDefault();
    if (!draftIsValid()) {
      setMessage("请填写当前分类最关键的两项内容。");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/records", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...draft } : draft),
      });
      const payload = (await response.json()) as { record?: ListeningRecord; error?: string };
      if (!response.ok || !payload.record) throw new Error(payload.error || "保存失败");
      setRecords((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? payload.record! : item))
          : [payload.record!, ...current]
      );
      setFormOpen(false);
      setEditingId(null);
      setMessage(editingId ? "记录已更新。" : "记录已保存，稍后记得回来复习。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(record: ListeningRecord, status: Status) {
    const response = await fetch("/api/records", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...record, status, reviewCount: record.reviewCount + 1 }),
    });
    const payload = (await response.json()) as { record?: ListeningRecord };
    if (payload.record) {
      setRecords((current) => current.map((item) => (item.id === record.id ? payload.record! : item)));
      setRevealed(false);
      setReviewIndex((index) => (reviewRecords.length ? (index + 1) % reviewRecords.length : 0));
    }
  }

  async function removeRecord(id: number) {
    if (!window.confirm("删除这条记录？此操作无法撤销。")) return;
    const response = await fetch(`/api/records?id=${id}`, { method: "DELETE" });
    if (response.ok) setRecords((current) => current.filter((record) => record.id !== id));
  }

  function clearFilters() {
    setSearch("");
    setBookFilter("all");
    setTestFilter("all");
    setPartFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
  }

  function exportRecords() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `雅思听力记录-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importRecords(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as ListeningRecord[];
      if (!Array.isArray(parsed)) throw new Error("格式错误");
      for (const item of parsed) {
        const { id, reviewCount, createdAt, updatedAt, ...rest } = item;
        void id;
        void reviewCount;
        void createdAt;
        void updatedAt;
        await fetch("/api/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rest),
        });
      }
      await loadRecords();
      setMessage(`已导入 ${parsed.length} 条记录。`);
    } catch {
      setMessage("导入失败，请选择由本网页导出的 JSON 文件。");
    }
  }

  const currentReview = reviewRecords.length ? reviewRecords[reviewIndex % reviewRecords.length] : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">L</div>
          <div>
            <p className="eyebrow">IELTS LISTENING LAB</p>
            <h1>听力错因档案</h1>
          </div>
        </div>
        <div className="header-actions">
          <span className="date-chip">{todayLabel()}</span>
          <button className="primary-button" onClick={() => openNew()}>
            <span aria-hidden="true">＋</span> 记一条
          </button>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <p className="eyebrow dark">CURRENT FOCUS · 剑雅 19</p>
          <h2>把“没听懂”拆成<br /><em>下一次能认出的线索。</em></h2>
          <p className="hero-copy">记录题目与录音之间的落差。复习时，不背答案，只复现证据。</p>
        </div>
        <div className="hero-progress" aria-label="掌握进度">
          <div className="progress-ring" style={{ "--progress": `${records.length ? Math.round((stats.mastered / records.length) * 100) : 0}%` } as React.CSSProperties}>
            <strong>{records.length ? Math.round((stats.mastered / records.length) * 100) : 0}%</strong>
            <span>已掌握</span>
          </div>
          <div className="hero-note">
            <span>本轮策略</span>
            <strong>同义替换 → 词组 → 长句意群</strong>
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="学习数据">
        <article><span>全部记录</span><strong>{stats.total}</strong><small>持续积累</small></article>
        <article><span>待复习</span><strong>{stats.due}</strong><small>今天先少量消化</small></article>
        <article><span>Part 3 待掌握</span><strong>{stats.partThree}</strong><small>当前薄弱区</small></article>
        <article><span>已掌握</span><strong>{stats.mastered}</strong><small>需要新题迁移验证</small></article>
      </section>

      <nav className="view-tabs" aria-label="页面视图">
        <button className={activeView === "records" ? "active" : ""} onClick={() => setActiveView("records")}>记录库</button>
        <button className={activeView === "review" ? "active" : ""} onClick={() => { setActiveView("review"); setRevealed(false); }}>复习卡片 <span>{reviewRecords.length}</span></button>
      </nav>

      {message && <div className="message-bar" role="status">{message}</div>}

      {activeView === "records" ? (
        <div className="workspace-grid">
          <aside className="filter-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">FILTER</p><h3>定位练习</h3></div>
              <button className="text-button" onClick={clearFilters}>清空</button>
            </div>
            <label className="search-field">
              <span>搜索内容</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="词组、句意、备注…" />
            </label>
            <div className="filter-row">
              <label><span>剑雅</span><select value={bookFilter} onChange={(event) => setBookFilter(event.target.value)}><option value="all">全部</option>{[21,20,19,18,17,16,15,14].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Test</span><select value={testFilter} onChange={(event) => setTestFilter(event.target.value)}><option value="all">全部</option>{[1,2,3,4].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Part</span><select value={partFilter} onChange={(event) => setPartFilter(event.target.value)}><option value="all">全部</option>{[1,2,3,4].map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>
            <fieldset>
              <legend>内容分类</legend>
              <button className={categoryFilter === "all" ? "filter-pill active" : "filter-pill"} onClick={() => setCategoryFilter("all")}>全部</button>
              {(Object.keys(categoryMeta) as Category[]).map((category) => <button key={category} className={categoryFilter === category ? "filter-pill active" : "filter-pill"} onClick={() => setCategoryFilter(category)}><span>{categoryMeta[category].short}</span>{categoryMeta[category].label}</button>)}
            </fieldset>
            <fieldset>
              <legend>掌握状态</legend>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | Status)}><option value="all">全部状态</option><option value="new">待复习</option><option value="reviewing">理解中</option><option value="mastered">已掌握</option></select>
            </fieldset>
            <div className="backup-actions">
              <button onClick={exportRecords} disabled={!records.length}>导出备份</button>
              <label>导入备份<input type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importRecords(file); }} /></label>
            </div>
          </aside>

          <section className="records-panel">
            <div className="panel-heading records-heading">
              <div><p className="eyebrow">LIBRARY</p><h3>学习记录 <span>{filteredRecords.length}</span></h3></div>
              <div className="quick-add">
                {(Object.keys(categoryMeta) as Category[]).map((category) => <button key={category} onClick={() => openNew(category)}><span>{categoryMeta[category].short}</span>{categoryMeta[category].label}</button>)}
              </div>
            </div>

            {loading ? (
              <div className="empty-state"><div className="loader" /><h3>正在整理记录</h3></div>
            ) : !filteredRecords.length ? (
              <div className="empty-state">
                <div className="empty-glyph">A → B</div>
                <h3>{records.length ? "没有符合筛选的记录" : "从第一组同义替换开始"}</h3>
                <p>{records.length ? "调整筛选条件，或清空筛选。" : "把剑雅19 Test 2 Part 3里最影响理解的一组表达记下来。"}</p>
                {!records.length && <button className="primary-button" onClick={() => openNew("paraphrase")}>添加同义替换</button>}
              </div>
            ) : (
              <div className="record-list">
                {filteredRecords.map((record) => (
                  <article className={`record-card category-${record.category}`} key={record.id}>
                    <div className="record-index">{categoryMeta[record.category].short}</div>
                    <div className="record-body">
                      <div className="record-meta">
                        <span>剑雅 {record.book}</span><span>Test {record.test}</span><span>Part {record.part}</span>{record.questionNumber && <span>Q{record.questionNumber}</span>}
                        <span className={`status-badge ${statusMeta[record.status].tone}`}>{statusMeta[record.status].label}</span>
                      </div>
                      <h4>{recordTitle(record)}</h4>
                      <div className="answer-line"><span aria-hidden="true">→</span><strong>{recordAnswer(record)}</strong></div>
                      {record.category === "vocabulary" && record.originalSentence && <blockquote>{record.originalSentence}</blockquote>}
                      {record.category === "sentence" && record.chunkedSentence && <blockquote>{record.chunkedSentence}</blockquote>}
                      {record.evidence && <p className="record-note"><b>答案作用：</b>{record.evidence}</p>}
                      {record.notes && <p className="record-note"><b>备注：</b>{record.notes}</p>}
                    </div>
                    <div className="record-actions"><button onClick={() => openEdit(record)}>编辑</button><button className="danger-link" onClick={() => void removeRecord(record.id)}>删除</button></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="review-stage">
          <div className="review-header">
            <div><p className="eyebrow">ACTIVE RECALL</p><h3>先回忆，再看答案</h3></div>
            <p>{reviewRecords.length ? `${reviewIndex % reviewRecords.length + 1} / ${reviewRecords.length}` : "0 / 0"}</p>
          </div>
          {!currentReview ? (
            <div className="empty-state"><div className="empty-glyph">✓</div><h3>当前筛选下没有待复习内容</h3><p>去记录库添加新记录，或把“已掌握”状态改回来。</p></div>
          ) : (
            <article className={`review-card category-${currentReview.category}`}>
              <div className="record-meta"><span>剑雅 {currentReview.book}</span><span>Test {currentReview.test}</span><span>Part {currentReview.part}</span><span>{categoryMeta[currentReview.category].label}</span></div>
              <p className="review-prompt">{categoryMeta[currentReview.category].hint}</p>
              <h2>{recordTitle(currentReview)}</h2>
              {!revealed ? (
                <button className="reveal-button" onClick={() => setRevealed(true)}>显示答案与证据</button>
              ) : (
                <div className="review-answer">
                  <span>答案</span><strong>{recordAnswer(currentReview)}</strong>
                  {currentReview.originalSentence && currentReview.category === "vocabulary" && <blockquote>{currentReview.originalSentence}</blockquote>}
                  {currentReview.chunkedSentence && <blockquote>{currentReview.chunkedSentence}</blockquote>}
                  {currentReview.evidence && <p>{currentReview.evidence}</p>}
                  <div className="review-actions"><button onClick={() => void updateStatus(currentReview, "new")}>还不熟</button><button onClick={() => void updateStatus(currentReview, "reviewing")}>已理解</button><button className="master-button" onClick={() => void updateStatus(currentReview, "mastered")}>已掌握</button></div>
                </div>
              )}
            </article>
          )}
        </section>
      )}

      {formOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
            <div className="modal-header">
              <div><p className="eyebrow">CAPTURE</p><h2 id="record-form-title">{editingId ? "编辑记录" : "记下这次没听懂的原因"}</h2></div>
              <button className="close-button" onClick={() => setFormOpen(false)} aria-label="关闭">×</button>
            </div>
            <form onSubmit={submitRecord}>
              <div className="location-grid">
                <label><span>剑雅</span><select value={draft.book} onChange={(event) => updateDraft("book", Number(event.target.value))}>{[21,20,19,18,17,16,15,14].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label><span>Test</span><select value={draft.test} onChange={(event) => updateDraft("test", Number(event.target.value))}>{[1,2,3,4].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label><span>Part</span><select value={draft.part} onChange={(event) => updateDraft("part", Number(event.target.value))}>{[1,2,3,4].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label><span>题号（可选）</span><input value={draft.questionNumber} onChange={(event) => updateDraft("questionNumber", event.target.value)} placeholder="21–22" /></label>
              </div>

              <fieldset className="category-picker">
                <legend>选择记录类型</legend>
                {(Object.keys(categoryMeta) as Category[]).map((category) => <button type="button" key={category} className={draft.category === category ? "active" : ""} onClick={() => updateDraft("category", category)}><span>{categoryMeta[category].short}</span><strong>{categoryMeta[category].label}</strong><small>{categoryMeta[category].hint}</small></button>)}
              </fieldset>

              {draft.category === "paraphrase" && <div className="dynamic-fields paraphrase-fields"><label><span>题干 / 选项表达 *</span><textarea value={draft.promptExpression} onChange={(event) => updateDraft("promptExpression", event.target.value)} placeholder="例如：be suitable for beginners" /></label><div className="arrow-divider">→</div><label><span>录音中的表达 *</span><textarea value={draft.audioExpression} onChange={(event) => updateDraft("audioExpression", event.target.value)} placeholder="例如：you don't need any previous experience" /></label></div>}

              {draft.category === "vocabulary" && <div className="dynamic-fields"><div className="two-columns"><label><span>生词 / 词组 *</span><input value={draft.phrase} onChange={(event) => updateDraft("phrase", event.target.value)} placeholder="be eligible for" /></label><label><span>此处意思 *</span><input value={draft.contextMeaning} onChange={(event) => updateDraft("contextMeaning", event.target.value)} placeholder="有资格参加……" /></label></div><label><span>录音原句</span><textarea value={draft.originalSentence} onChange={(event) => updateDraft("originalSentence", event.target.value)} placeholder="把词组放回它出现的原句，不抄全文。" /></label></div>}

              {draft.category === "sentence" && <div className="dynamic-fields"><label><span>录音长句 *</span><textarea value={draft.originalSentence} onChange={(event) => updateDraft("originalSentence", event.target.value)} placeholder="粘贴或写下影响理解的完整句子。" /></label><label><span>按意群切分</span><textarea value={draft.chunkedSentence} onChange={(event) => updateDraft("chunkedSentence", event.target.value)} placeholder="原计划… / 但是… / 最终决定…" /></label><label><span>一句中文概括 *</span><input value={draft.chineseSummary} onChange={(event) => updateDraft("chineseSummary", event.target.value)} placeholder="谁＋观点/动作＋转折＋最终结论" /></label></div>}

              <div className="two-columns extra-fields"><label><span>答案证据 / 作用</span><textarea value={draft.evidence} onChange={(event) => updateDraft("evidence", event.target.value)} placeholder="它怎样支持正确答案、排除干扰项？" /></label><label><span>自己的提醒</span><textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="下次应该注意什么？" /></label></div>
              <div className="form-footer"><label><span>掌握状态</span><select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as Status)}><option value="new">待复习</option><option value="reviewing">理解中</option><option value="mastered">已掌握</option></select></label><div><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>取消</button><button className="primary-button" disabled={saving}>{saving ? "保存中…" : editingId ? "保存修改" : "保存记录"}</button></div></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
