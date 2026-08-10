import { count, eq } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../db";
import { dailyEntries, speakingEntries, todoItems } from "../../../db/schema";

export async function GET() {
  try {
    await ensureSchema();
    const db = getDb();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const [todo, speaking, todayRows] = await Promise.all([
      db.select({ value: count() }).from(todoItems).where(eq(todoItems.completed, false)),
      db.select({ value: count() }).from(speakingEntries),
      db.select({ value: count() }).from(dailyEntries).where(eq(dailyEntries.date, today)),
    ]);
    return Response.json({ openTodos: todo[0]?.value || 0, speakingCount: speaking[0]?.value || 0, todayCount: todayRows[0]?.value || 0 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "数据概览暂时不可用" }, { status: 500 });
  }
}
