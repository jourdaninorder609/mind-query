import Database from 'better-sqlite3'
import type { IQueryExecutor, TableSchema } from '@/core/interfaces/IQueryExecutor'

/**
 * In-memory SQLite executor used when no MCP servers are configured.
 * Seeds a demo e-commerce dataset so users can test the UI immediately.
 */
export class DemoExecutor implements IQueryExecutor {
  private static db: Database.Database | null = null

  private getDb(): Database.Database {
    if (!DemoExecutor.db) {
      DemoExecutor.db = new Database(':memory:')
      this.seed(DemoExecutor.db)
    }
    return DemoExecutor.db
  }

  getDialect() { return 'SQLite' }
  getDisplayName() { return 'Demo (SQLite)' }

  async listTables(): Promise<string[]> {
    const rows = this.getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]
    return rows.map((r) => r.name)
  }

  async getSchema(tableName: string): Promise<TableSchema> {
    const cols = this.getDb()
      .prepare(`PRAGMA table_info("${tableName}")`)
      .all() as { name: string; type: string; notnull: number }[]
    return {
      tableName,
      columns: cols.map((c) => ({ name: c.name, type: c.type || 'TEXT', nullable: c.notnull === 0 })),
    }
  }

  async executeQuery(sql: string): Promise<Record<string, unknown>[]> {
    return this.getDb().prepare(sql).all() as Record<string, unknown>[]
  }

  private seed(db: Database.Database): void {
    db.exec(`
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        city TEXT,
        country TEXT DEFAULT 'Vietnam',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0
      );
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER REFERENCES customers(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        total_price REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        ordered_at TEXT DEFAULT (datetime('now'))
      );
    `)

    const ic = db.prepare('INSERT INTO customers (name,email,phone,city) VALUES (?,?,?,?)')
    ;[
      ['Nguyễn Văn An', 'an.nguyen@example.com', '0901234567', 'Hà Nội'],
      ['Trần Thị Bình', 'binh.tran@example.com', '0912345678', 'TP.HCM'],
      ['Lê Văn Cường', 'cuong.le@example.com', '0923456789', 'Đà Nẵng'],
      ['Phạm Thị Dung', 'dung.pham@example.com', '0934567890', 'Hải Phòng'],
      ['Hoàng Văn Em', 'em.hoang@example.com', '0945678901', 'Cần Thơ'],
      ['Vũ Thị Phương', 'phuong.vu@example.com', '0956789012', 'Huế'],
    ].forEach((r) => ic.run(...r))

    const ip = db.prepare('INSERT INTO products (name,category,price,stock) VALUES (?,?,?,?)')
    ;[
      ['Laptop Dell XPS 13', 'Electronics', 28990000, 15],
      ['iPhone 15 Pro', 'Electronics', 33990000, 8],
      ['Tai nghe AirPods Pro', 'Electronics', 6490000, 25],
      ['Chuột Logitech MX Master', 'Accessories', 2290000, 40],
      ['Bàn phím Keychron K2', 'Accessories', 1890000, 30],
    ].forEach((r) => ip.run(...r))

    const io = db.prepare('INSERT INTO orders (customer_id,product_id,quantity,total_price,status) VALUES (?,?,?,?,?)')
    ;[
      [1, 1, 1, 28990000, 'completed'],
      [2, 2, 1, 33990000, 'processing'],
      [3, 3, 2, 12980000, 'completed'],
      [1, 4, 1, 2290000, 'completed'],
      [4, 5, 2, 3780000, 'pending'],
      [5, 1, 1, 28990000, 'processing'],
      [2, 3, 1, 6490000, 'completed'],
      [6, 2, 1, 33990000, 'completed'],
    ].forEach((r) => io.run(...r))
  }
}
