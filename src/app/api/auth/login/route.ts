import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { setAuthCookie } from '@/lib/auth';

// --- In-memory rate limiter ---
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DELAY_MS = 1000; // 1-second artificial delay

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const entry = rateLimitMap.get(ip);
  if (!entry) return false;

  // Window expired — reset
  if (Date.now() - entry.firstAttempt > WINDOW_MS) {
    rateLimitMap.delete(ip);
    return false;
  }

  return entry.attempts >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    rateLimitMap.set(ip, { attempts: 1, firstAttempt: now });
  } else {
    entry.attempts += 1;
  }
}

function clearRateLimit(ip: string): void {
  rateLimitMap.delete(ip);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Periodically clean up stale entries (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.firstAttempt > WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 30 * 60 * 1000);

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Check rate limit BEFORE doing any work
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Příliš mnoho pokusů o přihlášení. Zkuste to znovu za 15 minut.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const password: unknown = body.password;

    // Validate password input
    if (typeof password !== 'string' || password.length === 0 || password.length > 200) {
      await delay(DELAY_MS);
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Nesprávné heslo' }, { status: 401 });
    }

    const adminPasswordHashB64 = process.env.ADMIN_PASSWORD_HASH;

    if (!adminPasswordHashB64) {
      return NextResponse.json(
        { error: 'Server chyba: heslo není nakonfigurováno' },
        { status: 500 }
      );
    }

    // Decode base64-encoded bcrypt hash (base64 avoids $ interpolation issues in .env)
    const adminPasswordHash = Buffer.from(adminPasswordHashB64, 'base64').toString();

    // Artificial delay on every attempt (success or failure)
    await delay(DELAY_MS);

    const isValid = await bcrypt.compare(password, adminPasswordHash);

    if (!isValid) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Nesprávné heslo' }, { status: 401 });
    }

    // Successful login — clear rate limit for this IP
    clearRateLimit(ip);

    await setAuthCookie();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Chyba při přihlášení' }, { status: 500 });
  }
}
