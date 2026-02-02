/**
 * Prometheus metrics exposition.
 * Scrape target for Prometheus; also usable by Datadog/CloudWatch agents.
 * No auth by default — restrict access at reverse proxy / ingress level.
 */
import { NextResponse } from 'next/server';
import { getPrometheusExposition } from '@/lib/verify-aggregator-metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const body = getPrometheusExposition();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
