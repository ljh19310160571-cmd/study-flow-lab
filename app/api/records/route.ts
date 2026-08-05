import { desc, eq } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../db";
import { listeningRecords } from "../../../db/schema";

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const numberInRange = (value: unknown, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

function valuesFrom(payload: Record<string, unknown>) {
  const book = numberInRange(payload.book, 1, 30);
  const test = numberInRange(payload.test, 1, 4);
  const part = numberInRange(payload.part, 1, 4);
  const categories = ["paraphrase", "vocabulary", "sentence"] as const;
  const statuses = ["new", "reviewing", "mastered"] as const;
  const category = categories.includes(payload.category as (typeof categories)[number])
    ? (payload.category as (typeof categories)[number])
    : null;
  const status = statuses.includes(payload.status as (typeof statuses)[number])
    ? (payload.status as (typeof statuses)[number])
    : "new";

  if (!book || !test || !part || !category) throw new Error("练习位置或记录类型无效");

  return {
    book,
    test,
    part,
    category,
    status,
    questionNumber: clean(payload.questionNumber),
    promptExpression: clean(payload.promptExpression),
    audioExpression: clean(payload.audioExpression),
    phrase: clean(payload.phrase),
    originalSentence: clean(payload.originalSentence),
    contextMeaning: clean(payload.contextMeaning),
    chunkedSentence: clean(payload.chunkedSentence),
    chineseSummary: clean(payload.chineseSummary),
    evidence: clean(payload.evidence),
    notes: clean(payload.notes),
    reviewCount: Math.max(0, Number(payload.reviewCount) || 0),
    updatedAt: new Date().toISOString(),
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "记录库暂时不可用";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    await ensureSchema();
    const db = getDb();
    const rows = await db.select().from(listeningRecords).orderBy(desc(listeningRecords.updatedAt), desc(listeningRecords.id));
    return Response.json({ records: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as Record<string, unknown>;
    const values = valuesFrom(payload);
    const db = getDb();
    const [record] = await db.insert(listeningRecords).values(values).returning();
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id)) return Response.json({ error: "记录编号无效" }, { status: 400 });
    const values = valuesFrom(payload);
    const db = getDb();
    const [record] = await db.update(listeningRecords).set(values).where(eq(listeningRecords.id, id)).returning();
    return Response.json({ record });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "记录编号无效" }, { status: 400 });
    const db = getDb();
    await db.delete(listeningRecords).where(eq(listeningRecords.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
