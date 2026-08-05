import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const listeningRecords = sqliteTable("listening_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  book: integer("book").notNull(),
  test: integer("test").notNull(),
  part: integer("part").notNull(),
  questionNumber: text("question_number").notNull().default(""),
  category: text("category", { enum: ["paraphrase", "vocabulary", "sentence"] }).notNull(),
  promptExpression: text("prompt_expression").notNull().default(""),
  audioExpression: text("audio_expression").notNull().default(""),
  phrase: text("phrase").notNull().default(""),
  originalSentence: text("original_sentence").notNull().default(""),
  contextMeaning: text("context_meaning").notNull().default(""),
  chunkedSentence: text("chunked_sentence").notNull().default(""),
  chineseSummary: text("chinese_summary").notNull().default(""),
  evidence: text("evidence").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status", { enum: ["new", "reviewing", "mastered"] }).notNull().default("new"),
  reviewCount: integer("review_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
