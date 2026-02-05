/** ALB / load balancer health check — no auth, returns 200 + { ok: true }. */
export async function GET() {
  return Response.json({ ok: true });
}
