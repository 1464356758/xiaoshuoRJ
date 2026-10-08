// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), kind: text('kind').notNull(),
  parent: text('parent').notNull().default(''), data: text('data').notNull(),
  revision: integer('revision').notNull().default(1), updated: integer('updated').notNull(),
}, t => [index('idx_records_owner_kind_parent').on(t.owner,t.kind,t.parent)]);
export const calls = sqliteTable('calls', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), book: text('book').notNull(),
  month: text('month').notNull(), amount: integer('amount').notNull(), status: text('status').notNull(),
  data: text('data').notNull(), created: integer('created').notNull(),
}, t => [index('idx_calls_owner_month').on(t.owner,t.month),index('idx_calls_owner_book').on(t.owner,t.book)]);
