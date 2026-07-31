import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, decodeSession, encodeSession, type Session } from "@/lib/session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8h

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  return raw ? decodeSession(raw) : null;
}

export async function setSessionCookie(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
