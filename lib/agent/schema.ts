/**
 * AI Agent: Drizzle schema для Postgres + pgvector.
 * Таблицы: agent_docs, agent_doc_chunks, agent_sessions, agent_messages, agent_doc_templates, agent_generated_documents.
 */
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  uuid,
  varchar,
  boolean,
} from 'drizzle-orm/pg-core';

export const agentDocs = pgTable('agent_docs', {
  id: uuid('id').primaryKey().defaultRandom(),
  path: text('path').notNull().unique(),
  filename: text('filename').notNull(),
  ext: varchar('ext', { length: 12 }).notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull(),
  extractedText: text('extracted_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agentDocChunks = pgTable('agent_doc_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  docId: uuid('doc_id')
    .notNull()
    .references(() => agentDocs.id, { onDelete: 'cascade' }),
  idx: integer('idx').notNull(),
  content: text('content').notNull(),
  embedding: text('embedding').notNull(), // vector(768) — raw SQL
});

export const agentSessions = pgTable('agent_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agentMessages = pgTable('agent_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => agentSessions.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 16 }).notNull(),
  content: text('content').notNull(),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agentDocTemplates = pgTable('agent_doc_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 64 }).notNull().unique(),
  title: text('title').notNull(),
  filePath: text('file_path').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const agentGeneratedDocuments = pgTable('agent_generated_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => agentSessions.id, { onDelete: 'set null' }),
  templateKey: varchar('template_key', { length: 64 }).notNull(),
  draftFields: jsonb('draft_fields').notNull(),
  missingFields: jsonb('missing_fields').notNull(),
  evidence: jsonb('evidence').notNull(),
  outputDocxPath: text('output_docx_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
