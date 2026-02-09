/**
 * Anchoring API types — shared between API routes and UI.
 * See docs/governance/ANCHORING_ARCHITECTURE.md
 *
 * Status semantics (ledger_anchors):
 * - pending: anchor created, not yet published (tx_hash absent) or tx sent but not confirmed
 * - confirmed: receipt confirmed, on-chain event verified
 * - failed: publish/confirm ended with error
 * - empty: events_count=0, publish forbidden
 */

export type AnchorNetwork = 'polygon';

export type AnchoringStatus = 'OK' | 'DELAYED' | 'FAILED';

export type AnchorRowStatus =
  | 'confirmed'
  | 'empty'
  | 'failed'
  | 'pending';

export interface AnchoringHealth {
  network: AnchorNetwork;
  chainId: number;
  status: AnchoringStatus;
  lastConfirmedAt: string | null;
  daysSinceLastConfirmed: number | null;
  windowDays: number;
  confirmedInWindow: number;
  emptyInWindow: number;
  failedInWindow: number;
  pendingOlderThanHours: number;
}

export interface AnchorListQuery {
  from: string;
  to: string;
  status?: AnchorRowStatus;
  limit?: number;
  offset?: number;
}

export interface AnchorListItem {
  anchorId: string;
  periodStart: string;
  periodEnd: string;
  eventsCount: number;
  status: AnchorRowStatus;
  hashAlgo: 'sha256';
  merkleRoot: string | null;
  network: AnchorNetwork | null;
  chainId: number | null;
  contractAddress: string | null;
  txHash: string | null;
  blockNumber: number | null;
  logIndex: number | null;
  anchoredAt: string | null;
  createdAt: string;
}

export interface AnchorListResponse {
  network: AnchorNetwork;
  chainId: number;
  range: { from: string; to: string };
  items: AnchorListItem[];
  page: { limit: number; offset: number; total: number };
}

export interface AnchorDetailResponse {
  anchor: AnchorListItem;
  receipt: {
    available: boolean;
    sha256: string | null;
    pathInPack: string | null;
  };
  verification: {
    signatureChainOk: boolean;
    merkleOk: boolean;
    onchainEventOk: boolean;
    notes: string[];
  };
}
