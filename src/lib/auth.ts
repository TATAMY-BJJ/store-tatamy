import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';

const SESSION_COOKIE = 'tatamy_admin_session';

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }
  return secret;
}

function createToken(): string {
  const timestamp = Date.now().toString();
  const hmac = createHmac('sha256', getSessionSecret())
    .update(timestamp)
    .digest('hex');
  return `${timestamp}.${hmac}`;
}

function verifyToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestamp, providedHmac] = parts;
  if (!timestamp || !providedHmac) return false;

  const expectedHmac = createHmac('sha256', getSessionSecret())
    .update(timestamp)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    const providedBuffer = Buffer.from(providedHmac, 'hex');
    const expectedBuffer = Buffer.from(expectedHmac, 'hex');

    if (providedBuffer.length !== expectedBuffer.length) return false;

    return timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export async function setAuthCookie() {
  const cookieStore = await cookies();
  const token = createToken();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 dní
    path: '/',
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
