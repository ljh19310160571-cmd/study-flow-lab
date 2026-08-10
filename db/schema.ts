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

export const todoItems = sqliteTable("todo_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["branch", "idea", "fix"] }).notNull().default("branch"),
  area: text("area", { enum: ["general", "listening", "speaking", "topik", "project"] }).notNull().default("general"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const speakingEntries = sqliteTable("speaking_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  part: integer("part").notNull(),
  topic: text("topic").notNull(),
  question: text("question").notNull(),
  keywords: text("keywords").notNull().default(""),
  fullAnswer: text("full_answer").notNull().default(""),
  expressions: text("expressions").notNull().default(""),
  reviewNotes: text("review_notes").notNull().default(""),
  rawText: text("raw_text").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dailyEntries = sqliteTable("daily_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  category: text("category", { enum: ["listening", "speaking", "topik", "project", "other"] }).notNull().default("other"),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull().default(0),
  unit: text("unit").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  notes: text("notes").notNull().default(""),
  source: text("source", { enum: ["manual", "timer"] }).notNull().default("manual"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dailyReviews = sqliteTable("daily_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  content: text("content").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
