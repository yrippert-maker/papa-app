/**
 * Prometheus metrics exposition.
 * Scrape target for Prometheus; also usable by Datadog/CloudWatch agents.
 * No auth by default — restrict access at reverse proxy / ingress level.
 */
import { NextResponse } from 'next/server';
import { getPrometheusExposition } from '@/lib/verify-aggregator-metrics';
import { getEvidenceVerifyMetricsPrometheus } from '@/lib/metrics/evidence-verify';

export const dynamic = 'force-dynamic';

export async function GET() {
  const aggregatorMetrics = getPrometheusExposition();
  const evidenceVerifyMetrics = getEvidenceVerifyMetricsPrometheus();
  const body = [aggregatorMetrics, '', evidenceVerifyMetrics].join('\n');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
