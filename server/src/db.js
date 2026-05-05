import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS weeks (
      week_key TEXT NOT NULL,
      iso_date TEXT NOT NULL,
      dish     TEXT NOT NULL,
      PRIMARY KEY (week_key, iso_date)
    );

    CREATE TABLE IF NOT EXISTS recipes (
      slug        TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      ingredients TEXT NOT NULL DEFAULT '',
      steps       TEXT NOT NULL DEFAULT '',
      notes       TEXT NOT NULL DEFAULT '',
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_images (
      recipe_slug TEXT    NOT NULL,
      position    INTEGER NOT NULL,
      filename    TEXT    NOT NULL,
      PRIMARY KEY (recipe_slug, position),
      FOREIGN KEY (recipe_slug) REFERENCES recipes(slug) ON DELETE CASCADE
    );
  `);

  return db;
}
