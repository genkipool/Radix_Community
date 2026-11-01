import 'server-only';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

/**
 * One-time ROLA challenges, kept in Supabase so every serverless instance
 * sees the same ones. Each expires five minutes after it is made (a database
 * default) and can be used once.
 */

/** Creates a challenge, or null when it could not be stored. */
export async function createChallenge(): Promise<string | null> {
    const challenge = crypto.randomBytes(32).toString('hex');
    const { error } = await supabaseAdmin.from('auth_challenges').insert({ challenge });
    if (error) {
        logger.error({ err: error }, '[Auth] Could not store a challenge');
        return null;
    }
    // Expired and used challenges are of no use to anyone; clearing them here
    // keeps the table small without a scheduled job.
    void deleteSpentChallenges();
    return challenge;
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

async function deleteSpentChallenges(): Promise<void> {
    const { error } = await supabaseAdmin
        .from('auth_challenges')
        .delete()
        .or(`used.eq.true,expires_at.lt.${new Date().toISOString()}`);
    if (error) logger.warn({ err: error }, '[Auth] Could not clear spent challenges');
}
