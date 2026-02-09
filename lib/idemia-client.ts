/**
 * IDEMIA GIPS Relying Service API — клиент для верификации по распознаванию лиц.
 * API: GIPS RS (gips-rs) — Identity Proofing
 * Endpoints: POST /gips/v1/identities, /consents, /id-documents/capture, /attributes/portrait/capture, /status, /proof
 *
 * Flow: Create Identity → Consent → Document → Selfie → Proof
 */

export type IdemiaClientOptions = {
  baseUrl?: string;
  apiKey?: string;
};

function getConfig(opts?: IdemiaClientOptions) {
  const baseUrl = opts?.baseUrl ?? process.env.IDEMIA_IDENTITY_PROOFING_URL ?? '';
  const apiKey = opts?.apiKey ?? process.env.IDEMIA_API_KEY ?? '';
  return { baseUrl, apiKey };
}

async function idemiaFetch(
  path: string,
  options: RequestInit & IdemiaClientOptions = {}
): Promise<Response> {
  const { baseUrl, apiKey } = getConfig(options);
  if (!baseUrl || !apiKey) {
    throw new Error('IDEMIA_IDENTITY_PROOFING_URL and IDEMIA_API_KEY required');
  }
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const { baseUrl: _, apiKey: __, ...rest } = options;
  return fetch(url, {
    ...rest,
    headers: {
      apikey: apiKey,
      ...(rest.headers as Record<string, string>),
    },
  });
}

export type IdemiaCreateIdentityResponse = {
  id: string;
  status: string;
  levelOfAssurance: string;
  creationDateTime: string;
  evaluationDateTime: string;
  upgradePaths?: Record<string, unknown>;
};

/** Step 1: Create Identity */
export async function createIdentity(opts?: IdemiaClientOptions): Promise<IdemiaCreateIdentityResponse> {
  const res = await idemiaFetch('/gips/v1/identities', {
    method: 'POST',
    body: new FormData(),
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA createIdentity: ${res.status} ${text}`);
  }
  return res.json();
}

/** Step 2: Submit Consent (PORTRAIT) */
export async function submitConsent(
  identityId: string,
  opts?: IdemiaClientOptions
): Promise<unknown> {
  const res = await idemiaFetch(`/gips/v1/identities/${identityId}/consents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ approved: true, type: 'PORTRAIT' }]),
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA submitConsent: ${res.status} ${text}`);
  }
  return res.json();
}

/** Step 3: Upload ID Document */
export async function captureIdDocument(
  identityId: string,
  documentFront: Blob | Buffer,
  documentBack?: Blob | Buffer,
  documentType = 'IDENTITY_CARD',
  opts?: IdemiaClientOptions
): Promise<{ id: string; status: string; type: string }> {
  const fd = new FormData();
  fd.append('DocumentFront', documentFront as Blob);
  if (documentBack) fd.append('DocumentBack', documentBack as Blob);
  const details = JSON.stringify({
    jurisdiction: 'ARE',
    documentType,
    source: 'LIVE_CAPTURE_IMAGE',
  });
  fd.append('DocumentCaptureDetails', new Blob([details], { type: 'application/json' }));

  const res = await idemiaFetch(`/gips/v1/identities/${identityId}/id-documents/capture`, {
    method: 'POST',
    body: fd,
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA captureIdDocument: ${res.status} ${text}`);
  }
  return res.json();
}

/** Step 4: Check Document Status */
export async function getDocumentStatus(
  identityId: string,
  documentId: string,
  opts?: IdemiaClientOptions
): Promise<{ id: string; status: string; type: string }> {
  const res = await idemiaFetch(
    `/gips/v1/identities/${identityId}/status/${documentId}`,
    { method: 'GET', ...opts }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA getDocumentStatus: ${res.status} ${text}`);
  }
  return res.json();
}

/** Step 6: Capture Selfie (portrait) */
export async function capturePortrait(
  identityId: string,
  portrait: Blob | Buffer,
  opts?: IdemiaClientOptions
): Promise<{ id: string; status: string; type: string }> {
  const fd = new FormData();
  fd.append('Portrait', portrait as Blob);

  const res = await idemiaFetch(`/gips/v1/identities/${identityId}/attributes/portrait/capture`, {
    method: 'POST',
    body: fd,
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA capturePortrait: ${res.status} ${text}`);
  }
  return res.json();
}

/** Step 7: Check Portrait Status */
export async function getPortraitStatus(
  identityId: string,
  portraitId: string,
  opts?: IdemiaClientOptions
): Promise<{ id: string; status: string; type: string }> {
  const res = await idemiaFetch(
    `/gips/v1/identities/${identityId}/status/${portraitId}`,
    { method: 'GET', ...opts }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA getPortraitStatus: ${res.status} ${text}`);
  }
  return res.json();
}

/** GET /gips/v1/identities/{id} — Identity details */
export async function getIdentity(
  identityId: string,
  opts?: IdemiaClientOptions
): Promise<Record<string, unknown>> {
  const res = await idemiaFetch(`/gips/v1/identities/${identityId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA getIdentity: ${res.status} ${text}`);
  }
  return res.json();
}

/** GET /gips/v1/identities/{id}/status — Identity status summary and evidence status */
export async function getIdentityStatus(
  identityId: string,
  opts?: IdemiaClientOptions
): Promise<{
  globalStatus?: { levelOfAssurance: string; status: string };
  idDocuments?: Array<{ evidenceStatus?: { status: string } }>;
  portrait?: { evidenceStatus?: { status: string } };
  [k: string]: unknown;
}> {
  const res = await idemiaFetch(`/gips/v1/identities/${identityId}/status`, {
    method: 'GET',
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA getIdentityStatus: ${res.status} ${text}`);
  }
  return res.json();
}

/** DELETE /gips/v1/identities/{id} — Delete all data related to the identity */
export async function deleteIdentity(
  identityId: string,
  opts?: IdemiaClientOptions
): Promise<void> {
  const res = await idemiaFetch(`/gips/v1/identities/${identityId}`, {
    method: 'DELETE',
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA deleteIdentity: ${res.status} ${text}`);
  }
}

/** Step 9: Retrieve Proof (archive) */
export async function getProof(
  identityId: string,
  opts?: IdemiaClientOptions
): Promise<ArrayBuffer> {
  const res = await idemiaFetch(`/gips/v1/identities/${identityId}/proof`, {
    method: 'GET',
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA getProof: ${res.status} ${text}`);
  }
  return res.arrayBuffer();
}

/** GET /gips/v1/identities/{id}/evidences/{evidenceId}/status — Evidence status (alternative to /status/{elementId}) */
export async function getEvidenceStatus(
  identityId: string,
  evidenceId: string,
  opts?: IdemiaClientOptions
): Promise<{ status: string; [k: string]: unknown }> {
  const res = await idemiaFetch(
    `/gips/v1/identities/${identityId}/evidences/${evidenceId}/status`,
    { method: 'GET', ...opts }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA getEvidenceStatus: ${res.status} ${text}`);
  }
  return res.json();
}

/** POST /gips/v1/identities/{id}/portrait-reference — Submit portrait reference (1:1 match without document) */
export async function submitPortraitReference(
  identityId: string,
  portrait: Blob | Buffer,
  opts?: IdemiaClientOptions
): Promise<{ id: string; status: string; [k: string]: unknown }> {
  const fd = new FormData();
  fd.append('Portrait', portrait as Blob);
  const res = await idemiaFetch(`/gips/v1/identities/${identityId}/portrait-reference`, {
    method: 'POST',
    body: fd,
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA submitPortraitReference: ${res.status} ${text}`);
  }
  return res.json();
}

/** GET /gips/healthcheck — Healthcheck */
export async function healthcheck(opts?: IdemiaClientOptions): Promise<Record<string, unknown>> {
  const res = await idemiaFetch('/gips/healthcheck', { method: 'GET', ...opts });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IDEMIA healthcheck: ${res.status} ${text}`);
  }
  return res.json();
}

/** Poll until status is VERIFIED, INVALID, or NOT_VERIFIED */
export async function pollUntilDone(
  identityId: string,
  checkId: string,
  getStatus: (id: string, docId: string) => Promise<{ status: string }>,
  timeoutMs = 60000,
  intervalMs = 2000
): Promise<'VERIFIED' | 'INVALID' | 'NOT_VERIFIED'> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await getStatus(identityId, checkId);
    if (['VERIFIED', 'LEVEL1', 'LEVEL2', 'LEVEL3', 'LEVEL4'].includes(result.status)) {
      return 'VERIFIED';
    }
    if (['INVALID', 'NOT_VERIFIED'].includes(result.status)) {
      return result.status as 'INVALID' | 'NOT_VERIFIED';
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('IDEMIA polling timeout');
}
