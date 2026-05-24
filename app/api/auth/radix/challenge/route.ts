import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Basic in-memory store for dev. In prod, use Redis or DB.
const challenges = new Map<string, { expires: number }>();

export async function GET() {
  const challenge = crypto.randomBytes(32).toString('hex');
  
  // Store challenge with 5 minute expiration
  challenges.set(challenge, { expires: Date.now() + 5 * 60 * 1000 });
  
  // Cleanup old challenges randomly (basic GC)
  if (Math.random() < 0.1) {
    const now = Date.now();
    for (const [key, value] of Array.from(challenges.entries())) {
      if (value.expires < now) challenges.delete(key);
    }
  }

  return NextResponse.json({ challenge });
}

export function isValidChallenge(challenge: string): boolean {
  const data = challenges.get(challenge);
  if (!data) return false;
  
  const isValid = data.expires > Date.now();
  challenges.delete(challenge); // One-time use
  return isValid;
}
