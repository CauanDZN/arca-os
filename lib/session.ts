export type Role = "admin" | "consultor" | "cliente";

export type Session = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  companyId?: string; // only for role "cliente", resolved once at login time
  assignedVerticals?: string[]; // only for role "consultor"; empty/absent = unrestricted, sees the whole portfolio
};

export const SESSION_COOKIE_NAME = "arca_session";

// UTF-8-safe base64 helpers using only btoa/atob so this file has zero runtime
// dependencies — it must import cleanly in both the Node server (actions,
// pages) and the Edge runtime (middleware.ts), where `Buffer` isn't reliably
// available.
function toBase64(input: string): string {
  const bytes = encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return btoa(bytes);
}

function fromBase64(input: string): string {
  const bytes = atob(input);
  return decodeURIComponent(
    bytes
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * NOTE: this is a mocked auth system on purpose. The session cookie is a
 * plain base64 JSON blob — not signed, not encrypted. It proves nothing
 * cryptographically; a real implementation would use signed/httpOnly session
 * tokens (e.g. next-auth, iron-session) so the payload can't be forged by
 * editing the cookie in devtools. Good enough to demonstrate real RBAC
 * routing rules, not good enough to protect real user data.
 */
export function encodeSession(session: Session): string {
  return toBase64(JSON.stringify(session));
}

export function decodeSession(value: string): Session | null {
  try {
    const parsed = JSON.parse(fromBase64(value));
    if (
      typeof parsed?.userId === "string" &&
      typeof parsed?.role === "string" &&
      (parsed.role === "admin" || parsed.role === "consultor" || parsed.role === "cliente")
    ) {
      return parsed as Session;
    }
    return null;
  } catch {
    return null;
  }
}
