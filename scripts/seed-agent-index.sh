#!/bin/bash
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DB="$ROOT/data/00_SYSTEM/db/papa.sqlite"
if [ ! -f "$DB" ]; then echo "Run: npm run migrate"; exit 1; fi
sqlite3 "$DB" "DELETE FROM doc_chunks_fts; DELETE FROM doc_chunks; DELETE FROM doc_metadata;"
sqlite3 "$DB" "INSERT INTO doc_metadata (id, path, filename, size, mtime, sha256, ext) VALUES ('a1111111-1111-1111-1111-111111111111', 'akt_tv3_117.md', 'akt_tv3_117.md', 533, datetime('now'), 'seed1', '.md'); INSERT INTO doc_chunks (id, doc_id, chunk_index, text) VALUES ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 0, 'Akt vhodnogo kontrolya TV3-117 Etalon'); INSERT INTO doc_chunks_fts (chunk_id, doc_id, text) VALUES ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Akt vhodnogo kontrolya TV3-117 Etalon');"
sqlite3 "$DB" "INSERT INTO doc_metadata (id, path, filename, size, mtime, sha256, ext) VALUES ('a2222222-2222-2222-2222-222222222222', 'reeestr.md', 'reeestr.md', 2331, datetime('now'), 'seed2', '.md'); INSERT INTO doc_chunks (id, doc_id, chunk_index, text) VALUES ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 0, 'Reestr etalonov TV3-117 Akt IKAO EASA ARMAC'); INSERT INTO doc_chunks_fts (chunk_id, doc_id, text) VALUES ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'Reestr etalonov TV3-117 Akt IKAO EASA ARMAC');"
echo "Indexed: 2 documents, 2 chunks"
