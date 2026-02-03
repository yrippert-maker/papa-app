/**
 * Mail store: mail events + proposals in S3.
 */
import { createHash } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { listKeys, getJsonObject } from './s3.mjs';

export function sha256Hex(s) {
  return createHash('sha256').update(s).digest('hex');
}

export function dayParts(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return { y, m, d: dd };
}

export function mailEventsPrefix(prefix, dateUtcIso) {
  const d = dateUtcIso ? new Date(dateUtcIso) : new Date();
  const { y, m, d: dd } = dayParts(d);
  return `${prefix}/${y}/${m}/${dd}/`;
}

export async function putJson(s3, { bucket, key, json }) {
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

export async function listMailEvents(s3, { bucket, prefix, limit = 200 }) {
  const keys = await listKeys(s3, { bucket, prefix, maxKeys: Math.min(limit, 5000) });
  const out = keys
    .filter((x) => x.key && x.key.endsWith('.json'))
    .sort((a, b) => (a.key < b.key ? 1 : -1))
    .slice(0, limit);
  return out;
}

export async function getMailEvent(s3, { bucket, key }) {
  return getJsonObject(s3, { bucket, key, maxBytes: 8_000_000 });
}

export async function putProposal(s3, { bucket, proposalsPrefix, proposal }) {
  const id = String(proposal?.proposal_id || '').trim();
  if (!id) throw new Error('missing proposal_id');
  const key = `${proposalsPrefix}/${id}.json`;
  const r = await putJson(s3, { bucket, key, json: proposal });
  return { key, sha256: r.sha256 };
}

export async function getProposal(s3, { bucket, proposalsPrefix, proposalId }) {
  const key = `${proposalsPrefix}/${proposalId}.json`;
  const j = await getJsonObject(s3, { bucket, key, maxBytes: 2_000_000 });
  return { key, proposal: j };
}
