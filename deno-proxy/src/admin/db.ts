// SQLite 数据库封装
import { DB } from "https://deno.land/x/sqlite@v3/mod.ts";
import { Upstream, Setting, GlobalSettings, UpstreamStrategy } from "./types.ts";

const DB_PATH = Deno.env.get("DATA_DIR") || "./data";
const DB_FILE = `${DB_PATH}/config.db`;

let db: DB | null = null;

/** 初始化数据库 */
export function initDatabase(): DB {
  if (db) return db;

  // 确保数据目录存在
  try {
    Deno.mkdirSync(DB_PATH, { recursive: true });
  } catch {
    // 目录已存在
  }

  db = new DB(DB_FILE);
  initTables(db);
  return db;
}

/** 获取数据库实例 */
export function getDb(): DB {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/** 初始化表结构 */
function initTables(database: DB): void {
  // 上游配置表
  database.execute(`
    CREATE TABLE IF NOT EXISTS upstreams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT,
      model TEXT,
      priority INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      strategy TEXT DEFAULT 'default',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // 设置表
  database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // 初始化默认设置
  const defaultSettings: Record<string, string> = {
    defaultStrategy: "default",
    timeoutMs: "30000",
    maxRetries: "3",
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    database.execute(
      `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
      [key, value],
    );
  }
}

// ============ Upstream CRUD ============

/** 获取所有上游 */
export function getAllUpstreams(): Upstream[] {
  const db = getDb();
  const rows = db.query(
    "SELECT id, name, base_url, api_key, model, priority, enabled, strategy, created_at, updated_at FROM upstreams ORDER BY priority DESC, id ASC"
  );

  return rows.map((row) => ({
    id: row[0] as number,
    name: row[1] as string,
    baseUrl: row[2] as string,
    apiKey: row[3] as string | undefined,
    model: row[4] as string | undefined,
    priority: row[5] as number,
    enabled: (row[6] as number) === 1,
    strategy: row[7] as UpstreamStrategy,
    createdAt: row[8] as number,
    updatedAt: row[9] as number,
  }));
}

/** 获取启用的上游 */
export function getEnabledUpstreams(): Upstream[] {
  const db = getDb();
  const rows = db.query(
    "SELECT id, name, base_url, api_key, model, priority, enabled, strategy, created_at, updated_at FROM upstreams WHERE enabled = 1 ORDER BY priority DESC, id ASC"
  );

  return rows.map((row) => ({
    id: row[0] as number,
    name: row[1] as string,
    baseUrl: row[2] as string,
    apiKey: row[3] as string | undefined,
    model: row[4] as string | undefined,
    priority: row[5] as number,
    enabled: (row[6] as number) === 1,
    strategy: row[7] as UpstreamStrategy,
    createdAt: row[8] as number,
    updatedAt: row[9] as number,
  }));
}

/** 根据 ID 获取上游 */
export function getUpstreamById(id: number): Upstream | null {
  const db = getDb();
  const rows = db.query(
    "SELECT id, name, base_url, api_key, model, priority, enabled, strategy, created_at, updated_at FROM upstreams WHERE id = ?",
    [id]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row[0] as number,
    name: row[1] as string,
    baseUrl: row[2] as string,
    apiKey: row[3] as string | undefined,
    model: row[4] as string | undefined,
    priority: row[5] as number,
    enabled: (row[6] as number) === 1,
    strategy: row[7] as UpstreamStrategy,
    createdAt: row[8] as number,
    updatedAt: row[9] as number,
  };
}

/** 创建上游 */
export function createUpstream(upstream: Omit<Upstream, "id" | "createdAt" | "updatedAt">): Upstream {
  const db = getDb();
  const now = Date.now();

  db.execute(
    `INSERT INTO upstreams (name, base_url, api_key, model, priority, enabled, strategy, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      upstream.name,
      upstream.baseUrl,
      upstream.apiKey || null,
      upstream.model || null,
      upstream.priority || 0,
      upstream.enabled ? 1 : 0,
      upstream.strategy || "default",
      now,
      now,
    ]
  );

  const id = db.query("SELECT last_insert_rowid()")[0][0] as number;
  return { ...upstream, id, createdAt: now, updatedAt: now };
}

/** 更新上游 */
export function updateUpstream(id: number, updates: Partial<Omit<Upstream, "id" | "createdAt" | "updatedAt">>): Upstream | null {
  const db = getDb();
  const existing = getUpstreamById(id);
  if (!existing) return null;

  const now = Date.now();
  const updated = { ...existing, ...updates, updatedAt: now };

  db.execute(
    `UPDATE upstreams SET name = ?, base_url = ?, api_key = ?, model = ?, priority = ?, enabled = ?, strategy = ?, updated_at = ? WHERE id = ?`,
    [
      updated.name,
      updated.baseUrl,
      updated.apiKey || null,
      updated.model || null,
      updated.priority,
      updated.enabled ? 1 : 0,
      updated.strategy,
      now,
      id,
    ]
  );

  return updated;
}

/** 删除上游 */
export function deleteUpstream(id: number): boolean {
  const db = getDb();
  const result = db.execute("DELETE FROM upstreams WHERE id = ?", [id]);
  return result.rowsAffected > 0;
}

/** 切换上游启用状态 */
export function toggleUpstream(id: number): Upstream | null {
  const db = getDb();
  const existing = getUpstreamById(id);
  if (!existing) return null;

  return updateUpstream(id, { enabled: !existing.enabled });
}

// ============ Settings CRUD ============

/** 获取所有设置 */
export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.query("SELECT key, value FROM settings");

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row[0] as string] = row[1] as string;
  }
  return settings;
}

/** 获取设置 */
export function getSetting(key: string): string | null {
  const db = getDb();
  const rows = db.query("SELECT value FROM settings WHERE key = ?", [key]);
  return rows.length > 0 ? rows[0][0] as string : null;
}

/** 设置设置项 */
export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, value]
  );
}

/** 获取全局设置 */
export function getGlobalSettings(): GlobalSettings {
  return {
    defaultStrategy: (getSetting("defaultStrategy") as UpstreamStrategy) || "default",
    defaultUpstreamId: getSetting("defaultUpstreamId") ? parseInt(getSetting("defaultUpstreamId")!) : undefined,
    timeoutMs: parseInt(getSetting("timeoutMs") || "30000"),
    maxRetries: parseInt(getSetting("maxRetries") || "3"),
  };
}

/** 更新全局设置 */
export function updateGlobalSettings(settings: Partial<GlobalSettings>): void {
  if (settings.defaultStrategy !== undefined) {
    setSetting("defaultStrategy", settings.defaultStrategy);
  }
  if (settings.defaultUpstreamId !== undefined) {
    setSetting("defaultUpstreamId", settings.defaultUpstreamId.toString());
  }
  if (settings.timeoutMs !== undefined) {
    setSetting("timeoutMs", settings.timeoutMs.toString());
  }
  if (settings.maxRetries !== undefined) {
    setSetting("maxRetries", settings.maxRetries.toString());
  }
}

// ============ 统计 ============

/** 获取上游数量 */
export function getUpstreamCount(): { total: number; enabled: number } {
  const db = getDb();
  const total = db.query("SELECT COUNT(*) FROM upstreams")[0][0] as number;
  const enabled = db.query("SELECT COUNT(*) FROM upstreams WHERE enabled = 1")[0][0] as number;
  return { total, enabled };
}

/** 关闭数据库连接 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
