import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/auth/radix/challenge
 *
 * Generates a one-time ROLA challenge and stores it in Supabase
 * (replaces the in-memory Map that was lost across serverless invocations).
 */
export async function POST() {
  const challenge = crypto.randomBytes(32).toString('hex');

  const { error } = await supabaseAdmin.from('auth_challenges').insert({
    challenge,
    // expires_at defaults to now() + 5 minutes via DB default
  });

  if (error) {
    console.error('Supabase challenge insert error:', error);
    return NextResponse.json(
      { error: 'Failed to create challenge' },
      { status: 500 },
    );
  }

  return NextResponse.json({ challenge });
}

/**
 * Validates a challenge: checks it exists, hasn't expired, and hasn't been used.
 * Marks the challenge as used atomically. Returns `true` if valid.
 */
export async function isValidChallenge(challenge: string): Promise<boolean> {
  // Attempt to mark unused + non-expired challenge as used in a single query
  const { data, error } = await supabaseAdmin
    .from('auth_challenges')
    .update({ used: true })
    .eq('challenge', challenge)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .select('id')
    .single();

  if (error || !data) return false;
  return true;
}
