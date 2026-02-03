#!/usr/bin/env node
/**
 * Mail MVP — ingestion: забор писем из Gmail и mail.nic.ru (IMAP).
 * Sprint M1: заглушка; далее — Gmail API / IMAP, формирование mail_event,
 * сохранение в object storage, запись в ledger.
 *
 * См. docs/plans/MAIL_MVP_SPEC.md (A1), MAIL_MVP_SPRINT_M1.md.
 *
 * Использование (после реализации):
 *   node scripts/mail-ingest.mjs [--source gmail|imap|all] [--dry-run]
 *
 * Переменные окружения (примеры для реализации):
 *   GMAIL_CREDENTIALS_JSON / GMAIL_TOKEN_PATH
 *   IMAP_NIC_HOST, IMAP_NIC_USER, IMAP_NIC_PASSWORD
 *   MAIL_EVENTS_BUCKET, MAIL_EVENTS_PREFIX
 *   LEDGER_BUCKET (или MAIL_LEDGER_*)
 */

const source = process.argv.includes('--source')
  ? process.argv[process.argv.indexOf('--source') + 1]
  : 'all';
const dryRun = process.argv.includes('--dry-run');

function main() {
  console.log('[mail-ingest] Mail MVP ingestion (stub)');
  console.log('[mail-ingest] Source:', source, '| Dry run:', dryRun);
  console.log('[mail-ingest] To implement: Gmail API or IMAP connectors → mail_event → object storage + ledger');
  console.log('[mail-ingest] Dedup: Message-ID primary, fallback sha256(normalized_headers+body+attachment_hashes)');
}

main();
