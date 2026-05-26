-- 1. Create the wallet_sessions table
CREATE TABLE public.wallet_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identity_address TEXT NOT NULL,
    network TEXT NOT NULL CHECK (network IN ('mainnet', 'stokenet')),
    persona_label TEXT,
    accounts JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- We ensure a single identity address can only have one session per network
    UNIQUE(identity_address, network)
);

-- Protect table: Only accessible via server-side service_role key
ALTER TABLE public.wallet_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Create the auth_challenges table for ROLA
CREATE TABLE public.auth_challenges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge TEXT NOT NULL UNIQUE,
    used BOOLEAN DEFAULT false,
    -- Automatically expire challenges after 5 minutes
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes'),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Protect table: Only accessible via server-side service_role key
ALTER TABLE public.auth_challenges ENABLE ROW LEVEL SECURITY;

-- Optional: Create an index for faster challenge lookups
CREATE INDEX idx_auth_challenges_lookup ON public.auth_challenges(challenge, used, expires_at);

-- Optional: Cleanup function to automatically delete expired challenges (can be scheduled via pg_cron if enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-expired-challenges', '*/15 * * * *', $$
--     DELETE FROM public.auth_challenges WHERE expires_at < now() OR used = true;
-- $$);
