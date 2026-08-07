"use client";

import { ClipboardEvent, useEffect, useMemo, useRef, useState } from "react";

type TimelineItem = {
  startMinute: number;
  endMinute: number;
  label: string;
};

type TimerPlan = {
  title: string;
  totalMinutes: number;
  items: TimelineItem[];
};

type SavedTimer = {
  input: string;
  plan: TimerPlan | null;
  remainingSeconds: number;
  running: boolean;
  endAt: number | null;
};

const STORAGE_KEY = "ielts-listening-timeline-timer";

const examplePlan = `IELTS P4：40分钟
0–5分钟：确认第一次错的4题
5–15分钟：处理拼写错误和漏 s，只记录机械提醒
15–30分钟：重听最后两道没听懂的题，对着题目听答案附近
30–35分钟：仍不懂再看原文，判断是生词、同义替换还是长句
35–40分钟：关掉原文，把 P4 连续听一遍，不暂停`;

function cleanLine(line: string) {
  return line
    .replace(/\*\*/g, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/^\s*(?:[-+•*]\s+)/, "")
    .trim();
}

function parseTimelineText(raw: string): TimerPlan {
  const lines = raw
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const titlePattern = /^(.*?)[：:]\s*(\d+)\s*分钟\s*$/;
  const itemPattern = /^(\d+)\s*(?:[–—\-~～]|至|到)\s*(\d+)\s*分钟\s*[：:]\s*(.+)$/;
  const titleLine = lines.find((line) => titlePattern.test(line));
  const titleMatch = titleLine?.match(titlePattern);

  const items = lines
    .map((line) => line.match(itemPattern))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      startMinute: Number(match[1]),
      endMinute: Number(match[2]),
      label: match[3].replace(/[。；;]\s*$/, "").trim(),
    }))
    .filter((item) => item.endMinute > item.startMinute && item.label)
    .sort((a, b) => a.startMinute - b.startMinute);

  if (!items.length) {
    throw new Error("没有识别到时间段。请使用“0–5分钟：任务名称”这样的格式。");
  }

  for (let index = 1; index < items.length; index += 1) {
    if (items[index].startMinute < items[index - 1].endMinute) {
      throw new Error("时间段存在重叠，请检查起止分钟。");
    }
  }

  const derivedTotal = Math.max(...items.map((item) => item.endMinute));
  const statedTotal = titleMatch ? Number(titleMatch[2]) : derivedTotal;
  const totalMinutes = Math.max(statedTotal, derivedTotal);
  const rawTitle = titleMatch?.[1] || "专注练习";
  const title = rawTitle
    .replace(/^\s*(?:\d+\s*[.、．]\s*)/, "")
    .replace(/^['‘’“”]+|['‘’“”]+$/g, "")
    .trim() || "专注练习";

  return { title, totalMinutes, items };
}

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remaining = safeSeconds % 60;
  const paddedMinutes = hours ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours ? `${hours}:` : ""}${paddedMinutes}:${String(remaining).padStart(2, "0")}`;
}

export default function TimelineTimer({ hidden = false }: { hidden?: boolean }) {
  const initialPlan = useMemo(() => parseTimelineText(examplePlan), []);
  const [input, setInput] = useState(examplePlan);
  const [plan, setPlan] = useState<TimerPlan | null>(initialPlan);
  const [remainingSeconds, setRemainingSeconds] = useState(initialPlan.totalMinutes * 60);
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [parseMessage, setParseMessage] = useState("示例计划已识别，可以直接开始。");
  const [hydrated, setHydrated] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeIndexRef = useRef(-1);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const value = JSON.parse(saved) as SavedTimer;
        const nextRemaining = value.running && value.endAt
          ? Math.max(0, Math.ceil((value.endAt - Date.now()) / 1000))
          : value.remainingSeconds;
        setInput(value.input || examplePlan);
        setPlan(value.plan || initialPlan);
        setRemainingSeconds(nextRemaining);
        setRunning(Boolean(value.running && value.endAt && nextRemaining > 0));
        setEndAt(value.running && nextRemaining > 0 ? value.endAt : null);
        setParseMessage("上次的计时计划已恢复。");
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, [initialPlan]);

  useEffect(() => {
    if (!hydrated) return;
    const saved: SavedTimer = { input, plan, remainingSeconds, running, endAt };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [hydrated, input, plan, remainingSeconds, running, endAt]);

  function prepareAudio() {
    if (!soundEnabled) return null;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
    return audioContextRef.current;
  }

  function playChime(times = 1) {
    const context = prepareAudio();
    if (!context) return;
    for (let index = 0; index < times; index += 1) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime + index * 0.22;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(index ? 760 : 660, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.2);
    }
  }

  useEffect(() => {
    if (!running || !endAt) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) {
        setRunning(false);
        setEndAt(null);
        playChime(2);
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [running, endAt]);

  const totalSeconds = (plan?.totalMinutes || 0) * 60;
  const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
  const progress = totalSeconds ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0;
  const activeIndex = useMemo(() => {
    if (!plan?.items.length) return -1;
    const elapsedMinutes = elapsedSeconds / 60;
    const exactIndex = plan.items.findIndex(
      (item) => elapsedMinutes >= item.startMinute && elapsedMinutes < item.endMinute
    );
    if (exactIndex >= 0) return exactIndex;
    if (remainingSeconds === 0) return plan.items.length - 1;
    const nextIndex = plan.items.findIndex((item) => elapsedMinutes < item.startMinute);
    return nextIndex >= 0 ? nextIndex : plan.items.length - 1;
  }, [plan, elapsedSeconds, remainingSeconds]);

  useEffect(() => {
    if (activeIndexRef.current === -1) {
      activeIndexRef.current = activeIndex;
      return;
    }
    if (running && activeIndex >= 0 && activeIndex !== activeIndexRef.current) playChime();
    activeIndexRef.current = activeIndex;
  }, [activeIndex, running]);

  const currentItem = activeIndex >= 0 ? plan?.items[activeIndex] : null;

  function applyText(text: string) {
    setInput(text);
    try {
      const nextPlan = parseTimelineText(text);
      setPlan(nextPlan);
      setRemainingSeconds(nextPlan.totalMinutes * 60);
      setRunning(false);
      setEndAt(null);
      activeIndexRef.current = 0;
      setParseMessage(`已识别 ${nextPlan.items.length} 个时间段，共 ${nextPlan.totalMinutes} 分钟。`);
    } catch (error) {
      setParseMessage(error instanceof Error ? error.message : "无法识别这段计划。");
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!pasted) return;
    event.preventDefault();
    applyText(pasted);
  }

  function toggleTimer() {
    if (!plan) return;
    prepareAudio();
    if (running) {
      const next = endAt ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) : remainingSeconds;
      setRemainingSeconds(next);
      setRunning(false);
      setEndAt(null);
      return;
    }
    const nextSeconds = remainingSeconds > 0 ? remainingSeconds : plan.totalMinutes * 60;
    setRemainingSeconds(nextSeconds);
    setEndAt(Date.now() + nextSeconds * 1000);
    setRunning(true);
  }

  function resetTimer() {
    if (!plan) return;
    setRunning(false);
    setEndAt(null);
    setRemainingSeconds(plan.totalMinutes * 60);
    activeIndexRef.current = 0;
  }

  return (
    <section className="timer-stage" hidden={hidden} aria-label="学习计时器">
      <div className="timer-heading">
        <div><p className="eyebrow">FOCUS TIMELINE</p><h3>把计划变成正在进行的任务</h3></div>
        <p>粘贴后自动识别“总时长＋时间段＋任务名称”</p>
      </div>

      <div className="timer-layout">
        <aside className="timer-import-card">
          <label>
            <span>粘贴时间规划</span>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPaste={handlePaste}
              placeholder={'IELTS P4：40分钟\n0–5分钟：确认错题\n5–15分钟：处理机械错误'}
            />
          </label>
          <p className="timer-format-hint">支持短横线、长横线、～、“至”和“到”。粘贴完整计划后会自动准备倒计时。</p>
          <div className="timer-import-actions">
            <button className="primary-button" type="button" onClick={() => applyText(input)}>识别并准备</button>
            <button className="secondary-button" type="button" onClick={() => applyText(examplePlan)}>载入示例</button>
          </div>
          <p className="timer-parse-message" role="status">{parseMessage}</p>
        </aside>

        <div className="timer-console">
          {plan ? (
            <>
              <div className="timer-now-card">
                <div className="timer-now-meta">
                  <span>{running ? "专注进行中" : remainingSeconds === 0 ? "本轮已完成" : "倒计时已准备"}</span>
                  <strong>{activeIndex + 1} / {plan.items.length}</strong>
                </div>
                <p>{plan.title}</p>
                <h2>{currentItem?.label || "准备开始"}</h2>
                <div className="timer-countdown" aria-live="polite">{formatCountdown(remainingSeconds)}</div>
                {currentItem && <small>{currentItem.startMinute}–{currentItem.endMinute} 分钟 · 本段 {currentItem.endMinute - currentItem.startMinute} 分钟</small>}
                <div className="timer-controls">
                  <button className="primary-button" type="button" onClick={toggleTimer}>{running ? "暂停" : remainingSeconds < totalSeconds && remainingSeconds > 0 ? "继续" : remainingSeconds === 0 ? "重新开始" : "开始倒计时"}</button>
                  <button className="secondary-button" type="button" onClick={resetTimer}>重置</button>
                  <button className="timer-sound-test" type="button" onClick={() => playChime()}>试听提示音</button>
                </div>
                <label className="sound-toggle"><input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} /> 时间段切换时播放提示音</label>
              </div>

              <div className="timeline-card">
                <div className="timeline-title"><div><p className="eyebrow">FULL TIMELINE</p><h3>完整进度</h3></div><strong>{Math.round(progress)}%</strong></div>
                <div className="timeline-progress" aria-label={`总进度 ${Math.round(progress)}%`}>
                  <div style={{ width: `${progress}%` }} />
                  {plan.items.slice(1).map((item) => <i key={item.startMinute} style={{ left: `${(item.startMinute / plan.totalMinutes) * 100}%` }} />)}
                </div>
                <ol className="timeline-list">
                  {plan.items.map((item, index) => {
                    const state = index < activeIndex || remainingSeconds === 0 ? "completed" : index === activeIndex ? "active" : "upcoming";
                    return (
                      <li className={state} key={`${item.startMinute}-${item.endMinute}-${item.label}`}>
                        <span>{index < activeIndex || remainingSeconds === 0 ? "✓" : index + 1}</span>
                        <div><strong>{item.label}</strong><small>{item.startMinute}–{item.endMinute} 分钟</small></div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          ) : (
            <div className="timer-empty"><div className="empty-glyph">00:00</div><h3>先粘贴一段时间规划</h3><p>识别成功后，这里会显示倒计时和完整 Timeline。</p></div>
          )}
        </div>
      </div>
    </section>
  );
}
