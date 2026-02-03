/**
 * Anchor Publisher — публикация Merkle root в Polygon (AnchorRegistry).
 * Offline audit: receipt сохраняется в workspace для auditor pack.
 */
import { getDb } from './db';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';

export interface PublishResult {
  ok: boolean;
  anchor_id: string;
  tx_hash?: string;
  error?: string;
}

export interface ConfirmResult {
  ok: boolean;
  anchor_id: string;
  block_number?: number;
  log_index?: number;
  error?: string;
}

function getConfig(): {
  rpcUrl: string;
  chainId: number;
  contractAddress: string;
  privateKey: string;
} | null {
  const rpc = process.env.ANCHOR_RPC_URL;
  const chainId = process.env.ANCHOR_CHAIN_ID;
  const contract = process.env.ANCHOR_CONTRACT_ADDRESS;
  const pk = process.env.ANCHOR_PUBLISHER_PRIVATE_KEY;
  if (!rpc || !chainId || !contract || !pk) return null;
  return {
    rpcUrl: rpc,
    chainId: parseInt(chainId, 10),
    contractAddress: contract,
    privateKey: pk,
  };
}

/**
 * Publishes anchor to Polygon. Requires viem + env.
 */
export async function publishAnchor(anchorId: string): Promise<PublishResult> {
  if (process.env.ANCHORING_PUBLISH_ENABLED !== 'true') {
    return { ok: false, anchor_id: anchorId, error: 'ANCHORING_PUBLISH_ENABLED not set (publish disabled)' };
  }
  const config = getConfig();
  if (!config) {
    return { ok: false, anchor_id: anchorId, error: 'ANCHOR_* env not set (publish disabled)' };
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM ledger_anchors WHERE id = ?').get(anchorId) as {
    period_start: string;
    period_end: string;
    merkle_root: string;
    events_count: number;
    status: string;
    tx_hash: string | null;
  } | undefined;
  if (!row) return { ok: false, anchor_id: anchorId, error: 'Anchor not found' };
  if (row.events_count === 0 || row.status === 'empty') {
    return { ok: false, anchor_id: anchorId, error: 'Empty period (0 events) — not publishing' };
  }
  if (row.status === 'confirmed' && row.tx_hash) {
    return { ok: true, anchor_id: anchorId, tx_hash: row.tx_hash };
  }

  try {
    const { createWalletClient, http, parseAbi } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { polygon } = await import('viem/chains');

    const periodStart = Math.floor(new Date(row.period_start).getTime() / 1000);
    const periodEnd = Math.floor(new Date(row.period_end).getTime() / 1000);
    const merkleRoot = '0x' + row.merkle_root;
    const anchorIdBytes32 = '0x' + createHash('sha256').update('anchor:' + anchorId).digest('hex');

    const account = privateKeyToAccount(('0x' + config.privateKey.replace(/^0x/, '')) as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: polygon,
      transport: http(config.rpcUrl),
    });

    const hash = await client.writeContract({
      address: config.contractAddress as `0x${string}`,
      abi: parseAbi([
        'function publish(bytes32 merkleRoot, uint64 periodStart, uint64 periodEnd, bytes32 anchorId)',
      ]),
      functionName: 'publish',
      args: [merkleRoot as `0x${string}`, BigInt(periodStart), BigInt(periodEnd), anchorIdBytes32 as `0x${string}`],
    });

    db.prepare(
      `UPDATE ledger_anchors SET tx_hash = ?, status = ?, network = ?, chain_id = ?, contract_address = ? WHERE id = ?`
    ).run(hash, 'pending', 'polygon', String(config.chainId), config.contractAddress, anchorId);

    return { ok: true, anchor_id: anchorId, tx_hash: hash };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, anchor_id: anchorId, error: msg };
  }
}

export interface RollupAnchorPublishResult {
  ok: boolean;
  tx_hash?: string;
  network?: string;
  chain_id?: number;
  contract_address?: string;
  error?: string;
}

/**
 * Publish ledger-rollup Merkle root to the same contract (domain=ledger-rollup).
 * Does not use DB; callable from ledger-rollup job.
 */
export async function publishRollupAnchor(params: {
  date_utc: string;
  merkle_root_sha256: string;
}): Promise<RollupAnchorPublishResult> {
  if (process.env.ANCHORING_PUBLISH_ENABLED !== 'true') {
    return { ok: false, error: 'ANCHORING_PUBLISH_ENABLED not set (publish disabled)' };
  }
  const config = getConfig();
  if (!config) {
    return { ok: false, error: 'ANCHOR_* env not set (publish disabled)' };
  }

  const { date_utc, merkle_root_sha256 } = params;
  const dayStart = new Date(date_utc + 'T00:00:00.000Z');
  const dayEnd = new Date(date_utc + 'T23:59:59.999Z');
  const periodStart = Math.floor(dayStart.getTime() / 1000);
  const periodEnd = Math.floor(dayEnd.getTime() / 1000);
  const anchorIdBytes32 = '0x' + createHash('sha256').update('ledger-rollup:' + date_utc).digest('hex').slice(0, 64);
  const merkleRoot = merkle_root_sha256.startsWith('0x') ? merkle_root_sha256 : '0x' + merkle_root_sha256;

  try {
    const { createWalletClient, http, parseAbi } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { polygon } = await import('viem/chains');

    const account = privateKeyToAccount(('0x' + config.privateKey.replace(/^0x/, '')) as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: polygon,
      transport: http(config.rpcUrl),
    });

    const hash = await client.writeContract({
      address: config.contractAddress as `0x${string}`,
      abi: parseAbi([
        'function publish(bytes32 merkleRoot, uint64 periodStart, uint64 periodEnd, bytes32 anchorId)',
      ]),
      functionName: 'publish',
      args: [merkleRoot as `0x${string}`, BigInt(periodStart), BigInt(periodEnd), anchorIdBytes32 as `0x${string}`],
    });

    return {
      ok: true,
      tx_hash: hash,
      network: 'polygon',
      chain_id: config.chainId,
      contract_address: config.contractAddress,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Confirms anchor by fetching receipt. Saves block_number, log_index, status=confirmed.
 */
export async function confirmAnchor(anchorId: string): Promise<ConfirmResult> {
  if (process.env.ANCHORING_CONFIRM_ENABLED !== 'true') {
    return { ok: false, anchor_id: anchorId, error: 'ANCHORING_CONFIRM_ENABLED not set (confirm disabled)' };
  }
  const config = getConfig();
  const rpc = config?.rpcUrl ?? process.env.ANCHOR_RPC_URL;
  if (!rpc) return { ok: false, anchor_id: anchorId, error: 'ANCHOR_RPC_URL not set' };

  const db = getDb();
  const row = db.prepare('SELECT * FROM ledger_anchors WHERE id = ?').get(anchorId) as {
    id: string;
    tx_hash: string | null;
    status: string;
    merkle_root: string;
    period_start: string;
    period_end: string;
    contract_address: string | null;
  } | undefined;
  if (!row || !row.tx_hash) return { ok: false, anchor_id: anchorId, error: 'No tx_hash' };
  if (row.status === 'confirmed') {
    const r = db.prepare('SELECT block_number, log_index FROM ledger_anchors WHERE id = ?').get(anchorId) as {
      block_number: number | null;
      log_index: number | null;
    };
    return { ok: true, anchor_id: anchorId, block_number: r?.block_number ?? undefined, log_index: r?.log_index ?? undefined };
  }

  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [row.tx_hash],
      }),
    });
    const data = (await res.json()) as {
      result?: { status: string; blockNumber: string; logs?: Array<{ address?: string; logIndex: string }> };
    };
    const receipt = data.result;
    if (!receipt || receipt.status !== '0x1') {
      return { ok: false, anchor_id: anchorId, error: 'Tx failed or not found' };
    }

    const blockNumber = parseInt(receipt.blockNumber, 16);
    const logs = receipt.logs ?? [];
    const contractAddr = (row.contract_address ?? process.env.ANCHOR_CONTRACT_ADDRESS)?.toLowerCase();
    const matchingLog = logs.find(
      (l) => l.address?.toLowerCase() === contractAddr
    );
    const logIndex = matchingLog ? parseInt(matchingLog.logIndex, 16) : 0;

    db.prepare(
      `UPDATE ledger_anchors SET status = ?, block_number = ?, log_index = ?, anchored_at = datetime('now') WHERE id = ?`
    ).run('confirmed', blockNumber, logIndex, anchorId);

    // Save receipt for offline audit (auditor pack)
    try {
      const receiptsDir = join(WORKSPACE_ROOT, '00_SYSTEM', 'anchor-receipts');
      mkdirSync(receiptsDir, { recursive: true });
      const receiptPath = join(receiptsDir, `${row.tx_hash.replace(/^0x/, '')}.json`);
      const fullReceipt = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionReceipt',
          params: [row.tx_hash],
        }),
      }).then((r) => r.json());
      writeFileSync(receiptPath, JSON.stringify(fullReceipt.result ?? fullReceipt, null, 2));
    } catch {
      // ignore
    }

    return { ok: true, anchor_id: anchorId, block_number: blockNumber, log_index: logIndex };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, anchor_id: anchorId, error: msg };
  }
}
