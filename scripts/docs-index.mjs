#!/usr/bin/env node
/**
 * docs:index — строит inventory + section map по DOCX из document-map.
 * Вывод: JSON в stdout или в файл.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const mapPath = join(root, 'config', 'ai-agent', 'document-map.json');
const map = JSON.parse(readFileSync(mapPath, 'utf-8'));
const docsRoot = join(root, map.root_path);

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

async function extractSectionsFromDocx(docPath) {
  if (!existsSync(docPath)) return [];
  const buf = readFileSync(docPath);
  const zip = await JSZip.loadAsync(buf);
  const docXml = zip.file('word/document.xml');
  if (!docXml) return [{ section_id: 'root', title: '(root)', path: '/' }];
  const xml = await docXml.async('string');
  const sections = [];
  const headingMatch = xml.matchAll(/<w:pStyle w:val="Heading(\d)"[^>]*>[\s\S]*?<w:t[^>]*>([^<]+)<\/w:t>/gi);
  let ord = 0;
  for (const m of headingMatch) {
    const level = parseInt(m[1], 10);
    const title = (m[2] || '').trim();
    if (!title) continue;
    ord++;
    const sectionId = `s${hash(title + ord)}`;
    const path = `/${title}`;
    sections.push({ section_id: sectionId, title, level, path });
  }
  if (sections.length === 0) sections.push({ section_id: 'root', title: '(root)', path: '/' });
  return sections;
}

async function main() {
  const inventory = { generated_at: new Date().toISOString(), root_path: map.root_path, documents: [] };
  for (const doc of map.documents) {
    const fullPath = join(docsRoot, doc.path);
    const sections = await extractSectionsFromDocx(fullPath);
    inventory.documents.push({
      id: doc.id,
      path: doc.path,
      exists: existsSync(fullPath),
      sections,
    });
  }
  const outPath = process.argv[2];
  const json = JSON.stringify(inventory, null, 2);
  if (outPath) {
    const fs = await import('fs');
    fs.writeFileSync(outPath, json);
    console.log('Written:', outPath);
  } else {
    console.log(json);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
