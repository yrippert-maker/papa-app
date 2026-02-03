#!/usr/bin/env node
/**
 * Mail MVP — rule-based triage: читает mail_event из S3, создаёт proposals.
 * Классификация: finance_payment | doc_mura_menasa | other.
 * Proposals пишет в MAIL_PROPOSALS_PREFIX (mail-proposals/).
 */
import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

function must(v, name) {
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}
function sha256Hex(s) {
  return createHash('sha256').update(s).digest('hex');
}
function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? `p_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function todayPrefix(eventsPrefix) {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${eventsPrefix}/${y}/${m}/${dd}/`;
}

async function readJson(s3, bucket, key) {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const c of out.Body) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function putJson(s3, bucket, key, json) {
  const body = JSON.stringify(json, null, 2);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    })
  );
  return { sha256: sha256Hex(body) };
}

async function listMailKeys(s3, bucket, prefix, limit = 200) {
  const out = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: Math.min(limit, 1000) })
  );
  return (out.Contents || []).map((x) => x.Key).filter(Boolean);
}

function classify(mail) {
  const text = `${mail.subject || ''}\n${mail.body_text || ''}`.toLowerCase();
  const finance = /(оплат|плат[её]ж|перевод|сч[её]т|invoice|paid|payment)/i.test(text);
  const mura = /(mura|menasa|документац)/i.test(text);
  if (finance) return 'finance_payment';
  if (mura) return 'doc_mura_menasa';
  return 'other';
}

function extractPayment(mail) {
  const t = `${mail.subject || ''}\n${mail.body_text || ''}`;
  const m = /(\d+[.,]\d{2}|\d+)\s*(RUB|₽|USD|EUR)/i.exec(t);
  const amount = m ? Number(String(m[1]).replace(',', '.')) : null;
  const currency = m ? (m[2].toUpperCase() === '₽' ? 'RUB' : m[2].toUpperCase()) : 'RUB';
  const date = (mail.received_at || new Date().toISOString()).slice(0, 10);
  const counterparty = (mail.from || '').slice(0, 120);
  if (!amount) return null;
  const payment_id = sha256Hex(`${date}|${amount}|${currency}|${counterparty}|${mail.message_id || ''}`).slice(0, 16);
  return {
    payment_id,
    date,
    amount,
    currency,
    counterparty,
    source_mail_id: mail.mail_id,
    source_message_id: mail.message_id || null,
  };
}

async function main() {
  const bucket = must(process.env.MAIL_BUCKET || process.env.LEDGER_BUCKET, 'MAIL_BUCKET or LEDGER_BUCKET');
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const eventsPrefix = (process.env.MAIL_EVENTS_PREFIX || 'mail-events').replace(/^\/+|\/+$/g, '');
  const proposalsPrefix = (process.env.MAIL_PROPOSALS_PREFIX || 'mail-proposals').replace(/^\/+|\/+$/g, '');
  const scanPrefix = process.env.MAIL_SCAN_PREFIX || todayPrefix(eventsPrefix);
  const limit = Math.min(Number(process.env.MAIL_SCAN_LIMIT || '200'), 500);
  const s3 = new S3Client({ region });

  const keys = await listMailKeys(s3, bucket, scanPrefix, limit);
  let outCount = 0;
  for (const key of keys) {
    if (!key.endsWith('.json')) continue;
    const mail = await readJson(s3, bucket, key);
    const category = classify(mail);
    const triage = {
      version: 1,
      mail_id: mail.mail_id,
      category,
      confidence: 0.6,
      summary: `${category}: ${mail.subject || ''}`.slice(0, 200),
      risk_flags: category === 'finance_payment' ? ['payment'] : [],
      entities: {},
      suggested_operator:
        category === 'finance_payment' ? 'ops-finance' : category === 'doc_mura_menasa' ? 'docs-owner' : 'ops',
      proposed_changes: [],
      created_at: new Date().toISOString(),
      source_key: key,
    };

    const proposals = [];
    if (category === 'finance_payment') {
      const p = extractPayment(mail);
      if (p) {
        triage.entities.payment = p;
        const proposal = {
          version: 1,
          proposal_id: uuid(),
          mail_id: mail.mail_id,
          doc_id: 'finance/payments',
          mode: 'append_json',
          patch: { append_items: [p] },
          risk_flags: ['payment'],
          summary: `Append payment ${p.amount} ${p.currency} on ${p.date}`,
          created_at: new Date().toISOString(),
          created_by: 'triage-agent',
          status: 'pending',
        };
        triage.proposed_changes.push({
          target: 'finance_payments_register',
          mode: 'append',
          explanation: proposal.summary,
        });
        proposals.push(proposal);
      }
    } else if (category === 'doc_mura_menasa') {
      const block = `### Incoming update (${new Date().toISOString().slice(0, 10)})\n- Subject: ${mail.subject || ''}\n- From: ${mail.from || ''}\n- Key: ${key}\n`;
      const proposal = {
        version: 1,
        proposal_id: uuid(),
        mail_id: mail.mail_id,
        doc_id: 'mura-menasa/handbook',
        mode: 'append_markdown',
        patch: { append_markdown: block },
        risk_flags: [],
        summary: 'Append draft update to mura-menasa handbook',
        created_at: new Date().toISOString(),
        created_by: 'triage-agent',
        status: 'pending',
      };
      triage.proposed_changes.push({ target: 'mura_menasa_doc', mode: 'append', explanation: proposal.summary });
      proposals.push(proposal);
    }

    const triageKey = `${proposalsPrefix}/triage-${mail.mail_id}.json`;
    await putJson(s3, bucket, triageKey, triage);

    for (const pr of proposals) {
      const prKey = `${proposalsPrefix}/${pr.proposal_id}.json`;
      await putJson(s3, bucket, prKey, pr);
      outCount += 1;
    }
  }

  console.log(JSON.stringify({ ok: true, proposals_written: outCount }, null, 2));
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(2);
});
