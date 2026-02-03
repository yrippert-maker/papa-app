import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { getJson } from '../lib/api';

export function DocumentPage() {
  const { docId } = useParams();
  const [doc, setDoc] = React.useState<{ doc_id: string; format: string; key: string; content: unknown } | null>(null);
  const [versions, setVersions] = React.useState<{ key: string }[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!docId) return;
    setErr(null);
    getJson(`/v1/docs/get?doc_id=${encodeURIComponent(decodeURIComponent(docId))}`)
      .then((j) => setDoc(j.doc))
      .catch((e: Error) => setErr(String(e?.message || e)));
    getJson(`/v1/docs/versions?doc_id=${encodeURIComponent(decodeURIComponent(docId))}&limit=30`)
      .then((j) => setVersions(j.versions || []))
      .catch(() => setVersions([]));
  }, [docId]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link to="/mail/inbox">Mail inbox</Link>
        <Link to="/days">Evidence</Link>
      </div>
      <h2>Document: {decodeURIComponent(docId ?? '')}</h2>
      {err ? <div style={{ color: 'crimson' }}>{err}</div> : null}
      {!doc ? <div>Loading...</div> : null}
      {doc ? (
        <div style={{ border: '1px solid #ddd', padding: 12 }}>
          <div>
            <b>format:</b> {doc.format}
          </div>
          <div>
            <b>key:</b> <code>{doc.key}</code>
          </div>
          <div style={{ marginTop: 10 }}>
            <b>content:</b>
            <pre style={{ whiteSpace: 'pre-wrap' }}>
              {doc.format === 'json' ? JSON.stringify(doc.content, null, 2) : String(doc.content ?? '')}
            </pre>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <h3>Versions</h3>
        <ul>
          {versions.map((v) => (
            <li key={v.key}>
              <code>{v.key.split('/').slice(-1)[0]}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
