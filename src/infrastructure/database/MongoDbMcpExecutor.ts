import type { IQueryExecutor, TableSchema } from '@/core/interfaces/IQueryExecutor'
import type { IMcpClient } from '../mcp/IMcpClient'

interface MongoQuery {
  operation: 'find' | 'aggregate' | 'listCollections' | 'listDatabases'
  collection: string
  filter?: Record<string, unknown>
  projection?: Record<string, unknown>
  sort?: Record<string, unknown>
  limit?: number
  skip?: number
  pipeline?: Record<string, unknown>[]
}

export class MongoDbMcpExecutor implements IQueryExecutor {
  constructor(
    private readonly mcp: IMcpClient,
    private readonly database: string
  ) {}

  getDialect() { return 'MongoDB' }
  getDisplayName() { return 'MongoDB' }

  async listTables(): Promise<string[]> {
    const result = await this.mcp.callTool<unknown>('list_collections', { database: this.database })
    if (Array.isArray(result)) return result.map((r) => (typeof r === 'string' ? r : String(r.name ?? r)))
    if (result && typeof result === 'object' && 'collections' in result) {
      return (result as { collections: string[] }).collections
    }
    return []
  }

  async getSchema(collectionName: string): Promise<TableSchema> {
    // MongoDB is schemaless — infer schema from a sample document
    const sample = await this.mcp.callTool<unknown>('find', {
      database: this.database,
      collection: collectionName,
      filter: {},
      limit: 1,
    })
    const docs = Array.isArray(sample) ? sample : (sample as { documents?: unknown[] })?.documents ?? []
    const firstDoc = docs[0] as Record<string, unknown> | undefined

    return {
      tableName: collectionName,
      columns: firstDoc
        ? Object.entries(firstDoc).map(([name, val]) => ({
            name,
            type: Array.isArray(val) ? 'array' : typeof val,
            nullable: true,
          }))
        : [],
    }
  }

  async executeQuery(queryJson: string): Promise<Record<string, unknown>[]> {
    const q = JSON.parse(queryJson) as MongoQuery

    if (q.operation === 'listDatabases') {
      const result = await this.mcp.callTool<unknown>('list_databases', {})
      const dbs = Array.isArray(result) ? result : []
      return (dbs as Array<{ name: string; sizeOnDisk?: number; empty?: boolean }>).map((db) => ({
        name: db.name,
        sizeOnDisk: db.sizeOnDisk ?? 0,
        empty: db.empty ?? false,
      }))
    }

    if (q.operation === 'listCollections') {
      const collections = await this.listTables()
      return collections.map((name) => ({ collection: name, database: this.database }))
    }

    if (q.operation === 'aggregate') {
      const result = await this.mcp.callTool<unknown>('aggregate', {
        database: this.database,
        collection: q.collection,
        pipeline: q.pipeline ?? [],
      })
      return this.extractDocs(result)
    }

    const result = await this.mcp.callTool<unknown>('find', {
      database: this.database,
      collection: q.collection,
      filter: q.filter ?? {},
      projection: q.projection ?? {},
      sort: q.sort ?? {},
      limit: q.limit ?? 100,
      skip: q.skip ?? 0,
    })
    return this.extractDocs(result)
  }

  private extractDocs(result: unknown): Record<string, unknown>[] {
    if (Array.isArray(result)) return result as Record<string, unknown>[]
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>
      if (Array.isArray(r.documents)) return r.documents as Record<string, unknown>[]
      if (Array.isArray(r.results)) return r.results as Record<string, unknown>[]
    }
    return []
  }
}
