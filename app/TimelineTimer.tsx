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

type ItemProgress = {
  completed: boolean;
  actualSeconds: number;
  addedSeconds: number;
};

type SavedTimer = {
  version: 2;
  input: string;
  plan: TimerPlan | null;
  activeIndex: number;
  stageRemainingSeconds: number;
  actualElapsedSeconds: number;
  itemProgress: ItemProgress[];
  running: boolean;
  savedAt: number;
};

type RunAnchor = {
  startedAt: number;
  stageRemainingSeconds: number;
  actualElapsedSeconds: number;
  itemActualSeconds: number;
  activeIndex: number;
};

const STORAGE_KEY = "ielts-listening-timeline-timer";

const examplePlan = `IELTS P4 高效复盘：45分钟
0–3分钟：整理4道错题，分别标记错因
3–8分钟：处理两个机械错误，只听答案句并记录提醒
8–16分钟：处理第一个理解错误，完成定位、诊断和复述
16–24分钟：处理第二个理解错误，完成定位、诊断和复述
24–30分钟：连续听最后两题所在段落并说出答案依据
30–40分钟：关掉原文，保留题目，完整连续听一遍 P4
40–45分钟：验收并记录仍然掉线的题号与原因`;

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

function plannedSeconds(item: TimelineItem) {
  return (item.endMinute - item.startMinute) * 60;
}

function createProgress(plan: TimerPlan): ItemProgress[] {
  return plan.items.map(() => ({ completed: false, actualSeconds: 0, addedSeconds: 0 }));
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remaining = safeSeconds % 60;
  const paddedMinutes = hours ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours ? `${hours}:` : ""}${paddedMinutes}:${String(remaining).padStart(2, "0")}`;
}

function formatUsedTime(seconds: number) {
  if (seconds < 60) return `${Math.max(0, seconds)} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining ? `${minutes} 分 ${remaining} 秒` : `${minutes} 分钟`;
}

export default function TimelineTimer({ hidden = false }: { hidden?: boolean }) {
  const initialPlan = useMemo(() => parseTimelineText(examplePlan), []);
  const [input, setInput] = useState(examplePlan);
  const [plan, setPlan] = useState<TimerPlan | null>(initialPlan);
  const [activeIndex, setActiveIndex] = useState(0);
  const [stageRemainingSeconds, setStageRemainingSeconds] = useState(plannedSeconds(initialPlan.items[0]));
  const [actualElapsedSeconds, setActualElapsedSeconds] = useState(0);
  const [itemProgress, setItemProgress] = useState<ItemProgress[]>(createProgress(initialPlan));
  const [running, setRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [parseMessage, setParseMessage] = useState("示例计划已识别，可以直接开始。");
  const [hydrated, setHydrated] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const runAnchorRef = useRef<RunAnchor | null>(null);
  const expiredChimeRef = useRef(false);

  useEffect(() => {
    try {
      const savedRaw = window.localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw) as Partial<SavedTimer> & { input?: string; plan?: TimerPlan | null };
        if (saved.version === 2 && saved.plan && saved.itemProgress?.length === saved.plan.items.length) {
          const safeIndex = Math.min(Math.max(saved.activeIndex || 0, 0), saved.plan.items.length - 1);
          const baseRemaining = Math.max(0, saved.stageRemainingSeconds || 0);
          const awaySeconds = saved.running && saved.savedAt
            ? Math.min(baseRemaining, Math.max(0, Math.floor((Date.now() - saved.savedAt) / 1000)))
            : 0;
          const nextProgress = saved.itemProgress.map((item, index) => (
            index === safeIndex ? { ...item, actualSeconds: item.actualSeconds + awaySeconds } : item
          ));
          const nextRemaining = Math.max(0, baseRemaining - awaySeconds);
          const nextActual = Math.max(0, (saved.actualElapsedSeconds || 0) + awaySeconds);

          setInput(saved.input || examplePlan);
          setPlan(saved.plan);
          setActiveIndex(safeIndex);
          setStageRemainingSeconds(nextRemaining);
          setActualElapsedSeconds(nextActual);
          setItemProgress(nextProgress);
          setRunning(false);
          setParseMessage(nextRemaining === 0 && !nextProgress[safeIndex]?.completed
            ? "上次计时已到点，可以完成本项或加时。"
            : "上次的计时计划和实际用时已恢复。");
        } else {
          const recoveredPlan = saved.plan || initialPlan;
          setInput(saved.input || examplePlan);
          setPlan(recoveredPlan);
          setActiveIndex(0);
          setStageRemainingSeconds(plannedSeconds(recoveredPlan.items[0]));
          setActualElapsedSeconds(0);
          setItemProgress(createProgress(recoveredPlan));
          setParseMessage("计时器已升级，原计划已保留，请重新开始。");
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, [initialPlan]);

  useEffect(() => {
    if (!hydrated) return;
    const saved: SavedTimer = {
      version: 2,
      input,
      plan,
      activeIndex,
      stageRemainingSeconds,
      actualElapsedSeconds,
      itemProgress,
      running,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [hydrated, input, plan, activeIndex, stageRemainingSeconds, actualElapsedSeconds, itemProgress, running]);

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

  function startRun(
    index = activeIndex,
    remaining = stageRemainingSeconds,
    elapsed = actualElapsedSeconds,
    progress = itemProgress,
  ) {
    if (!plan || remaining <= 0 || progress[index]?.completed) return;
    prepareAudio();
    runAnchorRef.current = {
      startedAt: Date.now(),
      stageRemainingSeconds: remaining,
      actualElapsedSeconds: elapsed,
      itemActualSeconds: progress[index].actualSeconds,
      activeIndex: index,
    };
    expiredChimeRef.current = false;
    setRunning(true);
  }

  function getSnapshot() {
    const anchor = runAnchorRef.current;
    if (!running || !anchor || anchor.activeIndex !== activeIndex) {
      return {
        remaining: stageRemainingSeconds,
        elapsed: actualElapsedSeconds,
        progress: itemProgress,
      };
    }
    const runSeconds = Math.min(
      anchor.stageRemainingSeconds,
      Math.max(0, Math.floor((Date.now() - anchor.startedAt) / 1000)),
    );
    const nextProgress = itemProgress.map((item, index) => (
      index === activeIndex ? { ...item, actualSeconds: anchor.itemActualSeconds + runSeconds } : item
    ));
    return {
      remaining: Math.max(0, anchor.stageRemainingSeconds - runSeconds),
      elapsed: anchor.actualElapsedSeconds + runSeconds,
      progress: nextProgress,
    };
  }

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const anchor = runAnchorRef.current;
      if (!anchor || anchor.activeIndex !== activeIndex) return;
      const runSeconds = Math.min(
        anchor.stageRemainingSeconds,
        Math.max(0, Math.floor((Date.now() - anchor.startedAt) / 1000)),
      );
      const remaining = Math.max(0, anchor.stageRemainingSeconds - runSeconds);
      setStageRemainingSeconds(remaining);
      setActualElapsedSeconds(anchor.actualElapsedSeconds + runSeconds);
      setItemProgress((current) => current.map((item, index) => (
        index === activeIndex ? { ...item, actualSeconds: anchor.itemActualSeconds + runSeconds } : item
      )));
      if (remaining === 0) {
        setRunning(false);
        runAnchorRef.current = null;
        if (!expiredChimeRef.current) {
          expiredChimeRef.current = true;
          playChime(2);
        }
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [running, activeIndex]);

  const sessionComplete = Boolean(plan?.items.length && itemProgress.length && itemProgress.every((item) => item.completed));
  const currentItem = plan?.items[activeIndex] || null;
  const currentProgress = itemProgress[activeIndex] || null;
  const currentBudgetSeconds = currentItem && currentProgress
    ? plannedSeconds(currentItem) + currentProgress.addedSeconds
    : 0;
  const plannedTotalSeconds = plan?.items.reduce((sum, item) => sum + plannedSeconds(item), 0) || 0;
  const adjustedTotalSeconds = plan?.items.reduce(
    (sum, item, index) => sum + plannedSeconds(item) + (itemProgress[index]?.addedSeconds || 0),
    0,
  ) || 0;
  const totalRemainingSeconds = plan?.items.reduce((sum, item, index) => {
    const progressItem = itemProgress[index];
    if (!progressItem || progressItem.completed || index < activeIndex) return sum;
    if (index === activeIndex) return sum + stageRemainingSeconds;
    return sum + plannedSeconds(item) + progressItem.addedSeconds;
  }, 0) || 0;
  const progressValue = plan?.items.reduce((sum, item, index) => {
    const progressItem = itemProgress[index];
    const budget = plannedSeconds(item) + (progressItem?.addedSeconds || 0);
    if (progressItem?.completed) return sum + budget;
    if (index === activeIndex && budget > 0) return sum + Math.min(budget, budget - stageRemainingSeconds);
    return sum;
  }, 0) || 0;
  const progress = adjustedTotalSeconds ? Math.min(100, (progressValue / adjustedTotalSeconds) * 100) : 0;

  function applyText(text: string) {
    setInput(text);
    try {
      const nextPlan = parseTimelineText(text);
      setPlan(nextPlan);
      setActiveIndex(0);
      setStageRemainingSeconds(plannedSeconds(nextPlan.items[0]));
      setActualElapsedSeconds(0);
      setItemProgress(createProgress(nextPlan));
      setRunning(false);
      runAnchorRef.current = null;
      expiredChimeRef.current = false;
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
    if (!plan || sessionComplete) return;
    if (running) {
      const snapshot = getSnapshot();
      setStageRemainingSeconds(snapshot.remaining);
      setActualElapsedSeconds(snapshot.elapsed);
      setItemProgress(snapshot.progress);
      setRunning(false);
      runAnchorRef.current = null;
      return;
    }
    if (stageRemainingSeconds > 0) startRun();
  }

  function completeCurrentItem() {
    if (!plan || sessionComplete || !currentProgress) return;
    const wasRunning = running;
    const snapshot = getSnapshot();
    const finishedProgress = snapshot.progress.map((item, index) => (
      index === activeIndex ? { ...item, completed: true } : item
    ));
    const nextIndex = activeIndex + 1;

    setRunning(false);
    runAnchorRef.current = null;
    setActualElapsedSeconds(snapshot.elapsed);
    setItemProgress(finishedProgress);
    playChime();

    if (nextIndex >= plan.items.length) {
      setStageRemainingSeconds(0);
      return;
    }

    const nextRemaining = plannedSeconds(plan.items[nextIndex]) + finishedProgress[nextIndex].addedSeconds;
    setActiveIndex(nextIndex);
    setStageRemainingSeconds(nextRemaining);
    if (wasRunning) {
      window.setTimeout(() => startRun(nextIndex, nextRemaining, snapshot.elapsed, finishedProgress), 0);
    }
  }

  function addTime(seconds: number) {
    if (!plan || sessionComplete || !currentProgress) return;
    const wasExpired = stageRemainingSeconds === 0;
    const snapshot = getSnapshot();
    const nextRemaining = snapshot.remaining + seconds;
    const nextProgress = snapshot.progress.map((item, index) => (
      index === activeIndex ? { ...item, addedSeconds: item.addedSeconds + seconds } : item
    ));

    setRunning(false);
    runAnchorRef.current = null;
    setStageRemainingSeconds(nextRemaining);
    setActualElapsedSeconds(snapshot.elapsed);
    setItemProgress(nextProgress);
    expiredChimeRef.current = false;

    if (running || wasExpired) {
      window.setTimeout(() => startRun(activeIndex, nextRemaining, snapshot.elapsed, nextProgress), 0);
    }
  }

  function resetTimer() {
    if (!plan) return;
    const nextProgress = createProgress(plan);
    setRunning(false);
    runAnchorRef.current = null;
    setActiveIndex(0);
    setStageRemainingSeconds(plannedSeconds(plan.items[0]));
    setActualElapsedSeconds(0);
    setItemProgress(nextProgress);
    expiredChimeRef.current = false;
  }

  const comparisonSeconds = actualElapsedSeconds - plannedTotalSeconds;

  return (
    <section className="timer-stage" hidden={hidden} aria-label="学习计时器">
      <div className="timer-heading">
        <div><p className="eyebrow">FOCUS TIMELINE</p><h3>按实际节奏推进每一项</h3></div>
        <p>提前完成就勾选进入下一项；时间不够时可以直接加时，实际用时会自动保留。</p>
      </div>

      <div className="timer-layout">
        <aside className="timer-import-card">
          <label>
            <span>粘贴时间规划</span>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPaste={handlePaste}
              placeholder={'IELTS P4：45分钟\n0–3分钟：整理错题\n3–8分钟：处理机械错误'}
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
              <div className={`timer-now-card${stageRemainingSeconds === 0 && !sessionComplete ? " time-up" : ""}`}>
                <div className="timer-now-meta">
                  <span>{sessionComplete ? "本轮已完成" : running ? "专注进行中" : stageRemainingSeconds === 0 ? "本段时间到了" : actualElapsedSeconds ? "已暂停" : "倒计时已准备"}</span>
                  <strong>{sessionComplete ? `${plan.items.length} / ${plan.items.length}` : `${activeIndex + 1} / ${plan.items.length}`}</strong>
                </div>
                <p>{plan.title}</p>
                <h2>{sessionComplete ? "今天的计划已经全部完成" : currentItem?.label || "准备开始"}</h2>

                {sessionComplete ? (
                  <div className="timer-finish-summary" aria-live="polite">
                    <span>本轮实际用时</span>
                    <strong>{formatTime(actualElapsedSeconds)}</strong>
                    <small>{comparisonSeconds === 0 ? "刚好按计划完成" : comparisonSeconds < 0 ? `比原计划少用 ${formatUsedTime(Math.abs(comparisonSeconds))}` : `比原计划多用 ${formatUsedTime(comparisonSeconds)}`}</small>
                  </div>
                ) : (
                  <div className="timer-time-grid">
                    <div className="timer-stage-clock"><span>本段剩余</span><strong aria-live="polite">{formatTime(stageRemainingSeconds)}</strong></div>
                    <div><span>本轮预计剩余</span><strong>{formatTime(totalRemainingSeconds)}</strong></div>
                    <div><span>实际已用</span><strong>{formatTime(actualElapsedSeconds)}</strong></div>
                  </div>
                )}

                {!sessionComplete && currentItem && (
                  <small>
                    原计划 {currentItem.endMinute - currentItem.startMinute} 分钟
                    {currentProgress?.addedSeconds ? ` · 已加时 ${formatUsedTime(currentProgress.addedSeconds)}` : ""}
                  </small>
                )}

                {stageRemainingSeconds === 0 && !sessionComplete && (
                  <p className="timer-expired-note">提示音已响。本项完成就打勾；还没完成则选择加时。</p>
                )}

                <div className="timer-controls">
                  {!sessionComplete && stageRemainingSeconds > 0 && (
                    <button className="primary-button" type="button" onClick={toggleTimer}>{running ? "暂停" : currentProgress?.actualSeconds ? "继续" : actualElapsedSeconds ? "开始本项" : "开始倒计时"}</button>
                  )}
                  {!sessionComplete && (
                    <button className="complete-stage-button" type="button" onClick={completeCurrentItem}>✓ 完成本项</button>
                  )}
                  {!sessionComplete && <button className="add-time-button" type="button" onClick={() => addTime(60)}>＋1 分钟</button>}
                  {!sessionComplete && <button className="add-time-button" type="button" onClick={() => addTime(300)}>＋5 分钟</button>}
                  <button className="secondary-button" type="button" onClick={resetTimer}>{sessionComplete ? "再来一轮" : "重置"}</button>
                  <button className="timer-sound-test" type="button" onClick={() => playChime()}>试听提示音</button>
                </div>
                <label className="sound-toggle"><input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} /> 阶段到点及手动完成时播放提示音</label>
              </div>

              <div className="timeline-card">
                <div className="timeline-title"><div><p className="eyebrow">FULL TIMELINE</p><h3>完整进度</h3></div><strong>{Math.round(progress)}%</strong></div>
                <div className="timeline-progress" aria-label={`总进度 ${Math.round(progress)}%`}>
                  <div style={{ width: `${progress}%` }} />
                </div>
                <ol className="timeline-list">
                  {plan.items.map((item, index) => {
                    const progressItem = itemProgress[index];
                    const state = progressItem?.completed ? "completed" : index === activeIndex ? "active" : "upcoming";
                    const canComplete = index === activeIndex && !progressItem?.completed && !sessionComplete;
                    return (
                      <li className={state} key={`${item.startMinute}-${item.endMinute}-${item.label}`}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{item.label}</strong>
                          <small>
                            计划 {item.endMinute - item.startMinute} 分钟
                            {progressItem?.addedSeconds ? ` ＋ ${formatUsedTime(progressItem.addedSeconds)}` : ""}
                            {(progressItem?.actualSeconds || progressItem?.completed) ? ` · 实际 ${formatUsedTime(progressItem.actualSeconds)}` : ""}
                          </small>
                        </div>
                        <button
                          className="timeline-check"
                          type="button"
                          disabled={!canComplete}
                          onClick={completeCurrentItem}
                          aria-label={progressItem?.completed ? `第 ${index + 1} 项已完成` : canComplete ? `完成第 ${index + 1} 项并进入下一项` : `第 ${index + 1} 项尚未开始`}
                          title={canComplete ? "完成并进入下一项" : undefined}
                        >
                          {progressItem?.completed ? "✓" : ""}
                        </button>
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
