/**
 * Minimal D1 stand-in backed by Node's built-in SQLite, so tests exercise the real
 * migrations and SQL. Implements only the D1 surface the Worker uses.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

class ShimStatement {
  private readonly db: DatabaseSync;
  private readonly sql: string;
  private readonly params: SQLInputValue[];

  constructor(db: DatabaseSync, sql: string, params: SQLInputValue[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...params: unknown[]): ShimStatement {
    return new ShimStatement(this.db, this.sql, params as SQLInputValue[]);
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as
      Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : { ...row }) as T;
  }

  async all<T>(): Promise<{ results: T[]; success: true; meta: object }> {
    const rows = this.db.prepare(this.sql).all(...this.params);
    return { results: rows.map((row) => ({ ...row }) as T), success: true, meta: {} };
  }

  runSync() {
    const info = this.db.prepare(this.sql).run(...this.params);
    return {
      results: [],
      success: true as const,
      meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
    };
  }

  async run() {
    return this.runSync();
  }
}

export class D1Shim {
  readonly sqlite: DatabaseSync;

  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.exec('PRAGMA foreign_keys = ON');
    const dir = join(import.meta.dirname, '..', 'migrations');
    for (const file of readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      this.sqlite.exec(readFileSync(join(dir, file), 'utf8'));
    }
  }

  prepare(sql: string): ShimStatement {
    return new ShimStatement(this.sqlite, sql);
  }

  async batch(statements: ShimStatement[]) {
    this.sqlite.exec('BEGIN');
    try {
      const results = statements.map((statement) => statement.runSync());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  asD1(): D1Database {
    return this as unknown as D1Database;
  }
}
