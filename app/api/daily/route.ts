import { desc, eq, gte } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../db";
import { dailyEntries, dailyReviews } from "../../../db/schema";

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const errorResponse = (error: unknown) => Response.json({ error: error instanceof Error ? error.message : "行动记录暂时不可用" }, { status: 500 });

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const since = new URL(request.url).searchParams.get("since") || "2000-01-01";
    const db = getDb();
    const [entries, reviews] = await Promise.all([
      db.select().from(dailyEntries).where(gte(dailyEntries.date, since)).orderBy(desc(dailyEntries.date), desc(dailyEntries.id)),
      db.select().from(dailyReviews).where(gte(dailyReviews.date, since)).orderBy(desc(dailyReviews.date)),
    ]);
    return Response.json({ entries, reviews });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const date = clean(body.date) || new Date().toISOString().slice(0, 10);
    const db = getDb();
    if (body.type === "review") {
      const [review] = await db.insert(dailyReviews).values({ date, content: clean(body.content), updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({ target: dailyReviews.date, set: { content: clean(body.content), updatedAt: new Date().toISOString() } }).returning();
      return Response.json({ review });
    }
    const categories = ["listening", "speaking", "topik", "project", "other"] as const;
    const category = categories.includes(body.category as typeof categories[number]) ? body.category as typeof categories[number] : "other";
    const title = clean(body.title);
    if (!title) return Response.json({ error: "请写下完成了什么" }, { status: 400 });
    const [entry] = await db.insert(dailyEntries).values({
      date, category, title,
      quantity: Math.max(0, Math.round(Number(body.quantity) || 0)),
      unit: clean(body.unit), durationMinutes: Math.max(0, Math.round(Number(body.durationMinutes) || 0)),
      notes: clean(body.notes), source: body.source === "timer" ? "timer" : "manual",
    }).returning();
    return Response.json({ entry }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id)) return Response.json({ error: "行动编号无效" }, { status: 400 });
    const categories = ["listening", "speaking", "topik", "project", "other"] as const;
    if (!categories.includes(body.category as typeof categories[number])) return Response.json({ error: "行动类别无效" }, { status: 400 });
    const date = clean(body.date);
    const title = clean(body.title);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "行动日期无效" }, { status: 400 });
    if (!title) return Response.json({ error: "请写下完成了什么" }, { status: 400 });
    const [entry] = await getDb().update(dailyEntries).set({
      date,
      category: body.category as typeof categories[number],
      title,
      quantity: Math.max(0, Math.round(Number(body.quantity) || 0)),
      unit: clean(body.unit),
      durationMinutes: Math.max(0, Math.round(Number(body.durationMinutes) || 0)),
      notes: clean(body.notes),
      updatedAt: new Date().toISOString(),
    }).where(eq(dailyEntries.id, id)).returning();
    if (!entry) return Response.json({ error: "没有找到这条行动记录" }, { status: 404 });
    return Response.json({ entry });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "行动编号无效" }, { status: 400 });
    await getDb().delete(dailyEntries).where(eq(dailyEntries.id, id));
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
