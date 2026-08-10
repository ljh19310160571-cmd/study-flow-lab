import { desc, eq } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../db";
import { todoItems } from "../../../db/schema";

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const errorResponse = (error: unknown) => Response.json(
  { error: error instanceof Error ? error.message : "待办事项暂时不可用" },
  { status: 500 },
);

export async function GET() {
  try {
    await ensureSchema();
    return Response.json({ items: await getDb().select().from(todoItems).orderBy(todoItems.completed, desc(todoItems.updatedAt)) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const title = clean(body.title);
    if (!title) return Response.json({ error: "先写下要记住的事情" }, { status: 400 });
    const kinds = ["branch", "idea", "fix"] as const;
    const areas = ["general", "listening", "speaking", "topik", "project"] as const;
    const kind = kinds.includes(body.kind as typeof kinds[number]) ? body.kind as typeof kinds[number] : "branch";
    const area = areas.includes(body.area as typeof areas[number]) ? body.area as typeof areas[number] : "general";
    const [item] = await getDb().insert(todoItems).values({ title, kind, area }).returning();
    return Response.json({ item }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id)) return Response.json({ error: "待办编号无效" }, { status: 400 });
    const [item] = await getDb().update(todoItems).set({
      completed: Boolean(body.completed),
      ...(clean(body.title) ? { title: clean(body.title) } : {}),
      updatedAt: new Date().toISOString(),
    }).where(eq(todoItems.id, id)).returning();
    return Response.json({ item });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "待办编号无效" }, { status: 400 });
    await getDb().delete(todoItems).where(eq(todoItems.id, id));
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
