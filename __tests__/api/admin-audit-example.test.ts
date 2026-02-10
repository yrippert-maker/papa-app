/**
 * API tests for GET/POST /api/admin/audit-example — RBAC guards.
 */
import type { Session } from "next-auth";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    auditEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "1" }),
    },
  },
}));

import { GET, POST } from "@/app/api/admin/audit-example/route";
import { getServerSession } from "next-auth";

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe("GET /api/admin/audit-example", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/admin/audit-example"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has only user role", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "1", email: "u@x", roles: ["user"] },
      expires: "",
    } as Session);
    const res = await GET(new Request("http://localhost/api/admin/audit-example"));
    expect(res.status).toBe(403);
  });

  it("returns 200 when auditor", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "1", email: "a@x", roles: ["auditor"] },
      expires: "",
    } as Session);
    const res = await GET(new Request("http://localhost/api/admin/audit-example"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toEqual([]);
  });

  it("returns 200 when admin", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "1", email: "a@x", roles: ["admin"] },
      expires: "",
    } as Session);
    const res = await GET(new Request("http://localhost/api/admin/audit-example"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/audit-example", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when auditor (read-only)", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "1", email: "a@x", roles: ["auditor"] },
      expires: "",
    } as Session);
    const res = await POST(
      new Request("http://localhost/api/admin/audit-example", {
        method: "POST",
        body: JSON.stringify({ action: "test.create" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 and creates AuditEvent when admin", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "1", email: "a@x", roles: ["admin"] },
      expires: "",
    } as Session);
    const res = await POST(
      new Request("http://localhost/api/admin/audit-example", {
        method: "POST",
        body: JSON.stringify({ action: "test.create", target: "Target:1" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.action).toBe("test.create");
    expect(body.target).toBe("Target:1");
  });
});
