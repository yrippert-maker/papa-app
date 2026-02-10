#!/usr/bin/env node
/**
 * mro:init — создаёт структуру папок для MRO регуляторики.
 * Запускать один раз после настройки PAPA_DB_ROOT.
 *
 * Структура:
 *   .../руководства/регуляторика/MRO/{ICAO,EASA,FAA,ARMAK}
 *   .../ARMAK/{AP-145,Guidance,Letters}
 *   .../выгрузки/MRO_UPDATES/
 */
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

const envLocal = path.join(process.cwd(), '.env.local');
if (existsSync(envLocal)) dotenv.config({ path: envLocal });
dotenv.config();

const papaRoot = process.env.PAPA_DB_ROOT?.trim();
if (!papaRoot) {
  console.error('PAPA_DB_ROOT is not set');
  process.exit(1);
}

const base = path.resolve(papaRoot);
const dirs = [
  path.join(base, 'руководства', 'регуляторика', 'MRO', 'ICAO'),
  path.join(base, 'руководства', 'регуляторика', 'MRO', 'EASA'),
  path.join(base, 'руководства', 'регуляторика', 'MRO', 'FAA'),
  path.join(base, 'руководства', 'регуляторика', 'MRO', 'ARMAK', 'AP-145'),
  path.join(base, 'руководства', 'регуляторика', 'MRO', 'ARMAK', 'Guidance'),
  path.join(base, 'руководства', 'регуляторика', 'MRO', 'ARMAK', 'Letters'),
  path.join(base, 'выгрузки', 'MRO_UPDATES'),
  path.join(base, 'руководства', 'регуляторика', 'INBOX', 'ARMAK'),
  path.join(base, 'руководства', 'регуляторика', 'INBOX', 'UDK_Klimov'),
  path.join(base, 'руководства', 'регуляторика', 'INBOX', 'UDK_Star'),
  path.join(base, 'выгрузки', 'INBOX_UPDATES'),
];

async function main() {
  for (const d of dirs) {
    await fs.mkdir(d, { recursive: true });
    console.log('Created:', d);
  }
  console.log('MRO folder structure ready');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
