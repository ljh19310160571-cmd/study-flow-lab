import { desc, eq } from "drizzle-orm";
import { ensureSchema, getDb } from "../../../db";
import { speakingEntries } from "../../../db/schema";

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const errorResponse = (error: unknown) => Response.json({ error: error instanceof Error ? error.message : "口语语料暂时不可用" }, { status: 500 });

export async function GET() {
  try {
    await ensureSchema();
    return Response.json({ entries: await getDb().select().from(speakingEntries).orderBy(desc(speakingEntries.updatedAt), desc(speakingEntries.id)) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const part = Number(body.part);
    const topic = clean(body.topic);
    const question = clean(body.question);
    if (![1, 2, 3].includes(part) || !topic || !question) return Response.json({ error: "请确认 Part、主题和问题" }, { status: 400 });
    const [entry] = await getDb().insert(speakingEntries).values({
      part, topic, question,
      keywords: clean(body.keywords), fullAnswer: clean(body.fullAnswer),
      expressions: clean(body.expressions), reviewNotes: clean(body.reviewNotes), rawText: clean(body.rawText),
    }).returning();
    return Response.json({ entry }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "语料编号无效" }, { status: 400 });
    await getDb().delete(speakingEntries).where(eq(speakingEntries.id, id));
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
