/**
 * Unit tests for lib/requireRole — RBAC guards.
 */
import { requireRole, requireRoleForApi } from "@/lib/requireRole";

describe("requireRole", () => {
  it("throws when roles empty and required is admin", () => {
    expect(() => requireRole([], "admin")).toThrow("FORBIDDEN");
  });

  it("throws when user has user role but admin required", () => {
    expect(() => requireRole(["user"], "admin")).toThrow("FORBIDDEN");
  });

  it("does not throw when user has admin", () => {
    expect(() => requireRole(["admin"], "admin")).not.toThrow();
  });

  it("accepts auditor for auditor required", () => {
    expect(() => requireRole(["auditor"], "auditor")).not.toThrow();
  });

  it("accepts admin when admin or auditor required", () => {
    expect(() => requireRole(["admin"], ["admin", "auditor"])).not.toThrow();
  });

  it("accepts auditor when admin or auditor required", () => {
    expect(() => requireRole(["auditor"], ["admin", "auditor"])).not.toThrow();
  });

  it("is case-insensitive", () => {
    expect(() => requireRole(["ADMIN"], "admin")).not.toThrow();
    expect(() => requireRole(["admin"], "ADMIN")).not.toThrow();
  });
});

describe("requireRoleForApi", () => {
  const req = new Request("http://localhost/test");

  it("returns 401 when session is null", () => {
    const res = requireRoleForApi(null, "admin", req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns 401 when session has no user", () => {
    const res = requireRoleForApi({ user: undefined }, "admin", req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns 401 when session user has no id", () => {
    const res = requireRoleForApi({ user: { id: undefined, roles: ["admin"] } }, "admin", req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns 403 when user lacks required role", () => {
    const res = requireRoleForApi(
      { user: { id: "1", roles: ["user"] } },
      "admin",
      req
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("returns null when user has required role", () => {
    const res = requireRoleForApi(
      { user: { id: "1", roles: ["admin"] } },
      "admin",
      req
    );
    expect(res).toBeNull();
  });

  it("returns null when user has one of required roles", () => {
    const res = requireRoleForApi(
      { user: { id: "1", roles: ["auditor"] } },
      ["admin", "auditor"],
      req
    );
    expect(res).toBeNull();
  });
});
