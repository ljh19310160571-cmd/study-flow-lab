import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function ensureSchema() {
  if (!env.DB) throw new Error("记录数据库暂时不可用");
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS listening_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      book INTEGER NOT NULL,
      test INTEGER NOT NULL,
      part INTEGER NOT NULL,
      question_number TEXT DEFAULT '' NOT NULL,
      category TEXT NOT NULL,
      prompt_expression TEXT DEFAULT '' NOT NULL,
      audio_expression TEXT DEFAULT '' NOT NULL,
      phrase TEXT DEFAULT '' NOT NULL,
      original_sentence TEXT DEFAULT '' NOT NULL,
      context_meaning TEXT DEFAULT '' NOT NULL,
      chunked_sentence TEXT DEFAULT '' NOT NULL,
      chinese_summary TEXT DEFAULT '' NOT NULL,
      evidence TEXT DEFAULT '' NOT NULL,
      notes TEXT DEFAULT '' NOT NULL,
      status TEXT DEFAULT 'new' NOT NULL,
      review_count INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `).run();

  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS todo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      title TEXT NOT NULL,
      kind TEXT DEFAULT 'branch' NOT NULL,
      area TEXT DEFAULT 'general' NOT NULL,
      completed INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS speaking_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      part INTEGER NOT NULL,
      topic TEXT NOT NULL,
      question TEXT NOT NULL,
      keywords TEXT DEFAULT '' NOT NULL,
      full_answer TEXT DEFAULT '' NOT NULL,
      expressions TEXT DEFAULT '' NOT NULL,
      review_notes TEXT DEFAULT '' NOT NULL,
      raw_text TEXT DEFAULT '' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS daily_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      date TEXT NOT NULL,
      category TEXT DEFAULT 'other' NOT NULL,
      title TEXT NOT NULL,
      quantity INTEGER DEFAULT 0 NOT NULL,
      unit TEXT DEFAULT '' NOT NULL,
      duration_minutes INTEGER DEFAULT 0 NOT NULL,
      notes TEXT DEFAULT '' NOT NULL,
      source TEXT DEFAULT 'manual' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS daily_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      date TEXT NOT NULL UNIQUE,
      content TEXT DEFAULT '' NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
  ]);
}
