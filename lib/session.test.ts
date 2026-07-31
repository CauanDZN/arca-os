import { describe, it, expect } from "vitest";
import { encodeSession, decodeSession, type Session } from "@/lib/session";

const session: Session = {
  userId: "u1",
  name: "Ana Souza — Sponsor",
  email: "ana@example.com",
  role: "cliente",
  title: "Sponsor do Cliente",
  companyId: "c1",
};

describe("encodeSession/decodeSession", () => {
  it("round-trips a session, including non-ASCII characters", () => {
    const encoded = encodeSession(session);
    const decoded = decodeSession(encoded);
    expect(decoded).toEqual(session);
  });

  it("round-trips a session without companyId (admin/consultor roles)", () => {
    const adminSession: Session = {
      userId: "u2",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      title: "CEO",
    };
    expect(decodeSession(encodeSession(adminSession))).toEqual(adminSession);
  });

  it("returns null for garbage input instead of throwing", () => {
    expect(decodeSession("not-valid-base64!!!")).toBeNull();
  });

  it("returns null when the decoded payload doesn't look like a Session", () => {
    const tampered = btoa(JSON.stringify({ foo: "bar" }));
    expect(decodeSession(tampered)).toBeNull();
  });

  it("returns null when the role isn't one of the known values", () => {
    const tampered = btoa(JSON.stringify({ userId: "u1", role: "superadmin" }));
    expect(decodeSession(tampered)).toBeNull();
  });
});
