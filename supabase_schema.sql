-- ============================================================================
-- Complete & Unified Supabase Database Schema & Migration
-- Works on fresh databases AND migrates existing databases safely.
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Loader UI Configurations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loader_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand_name TEXT NOT NULL DEFAULT 'AERO AUTH',
    title TEXT NOT NULL DEFAULT 'Script Authentication',
    accent_color TEXT NOT NULL DEFAULT '#00a2ff',
    background_color TEXT NOT NULL DEFAULT '#1e1e24',
    card_color TEXT NOT NULL DEFAULT '#25252b',
    text_color TEXT NOT NULL DEFAULT '#ffffff',
    subtext_color TEXT NOT NULL DEFAULT '#8e8e9f',
    corner_radius INTEGER NOT NULL DEFAULT 8,
    frame_width INTEGER NOT NULL DEFAULT 360,
    frame_height INTEGER NOT NULL DEFAULT 240,
    font_face TEXT NOT NULL DEFAULT 'GothamMedium',
    show_brand_icon BOOLEAN NOT NULL DEFAULT true,
    custom_subtitle TEXT NOT NULL DEFAULT 'Enter your license key below',
    key_placeholder TEXT DEFAULT 'Paste your license key here...',
    verify_button_text TEXT DEFAULT 'VERIFY KEY',
    claim_button_text TEXT DEFAULT 'CLAIM YOUR KEY (COPY LINK)',
    show_discord_button BOOLEAN DEFAULT false,
    discord_button_text TEXT DEFAULT 'JOIN DISCORD',
    discord_invite_url TEXT DEFAULT 'https://discord.gg/',
    show_watermark BOOLEAN DEFAULT true,
    watermark_text TEXT DEFAULT 'AERO PROTECT',
    logo_url TEXT DEFAULT '',
    show_logo BOOLEAN DEFAULT false,
    layout_positions JSONB DEFAULT '{}'::jsonb,
    webhook_enabled BOOLEAN NOT NULL DEFAULT false,
    webhook_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migration for existing loader_configs
ALTER TABLE public.loader_configs 
    ADD COLUMN IF NOT EXISTS layout_positions JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS key_placeholder TEXT DEFAULT 'Paste your license key here...',
    ADD COLUMN IF NOT EXISTS verify_button_text TEXT DEFAULT 'VERIFY KEY',
    ADD COLUMN IF NOT EXISTS claim_button_text TEXT DEFAULT 'CLAIM YOUR KEY (COPY LINK)',
    ADD COLUMN IF NOT EXISTS show_discord_button BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS discord_button_text TEXT DEFAULT 'JOIN DISCORD',
    ADD COLUMN IF NOT EXISTS discord_invite_url TEXT DEFAULT 'https://discord.gg/',
    ADD COLUMN IF NOT EXISTS show_watermark BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS watermark_text TEXT DEFAULT 'AERO PROTECT',
    ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT false;

-- ----------------------------------------------------------------------------
-- 2. Modular Scripts Vault
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    entry_file TEXT NOT NULL DEFAULT 'main.lua',
    modules JSONB NOT NULL DEFAULT '{}'::jsonb,
    loader_config_id UUID REFERENCES public.loader_configs(id) ON DELETE SET NULL,
    watermark_text TEXT NOT NULL DEFAULT 'AERO PROTECT',
    show_watermark BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    use_auth BOOLEAN NOT NULL DEFAULT true,
    lua_code TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migration for existing scripts
ALTER TABLE public.scripts
    ADD COLUMN IF NOT EXISTS entry_file TEXT DEFAULT 'main.lua',
    ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS watermark_text TEXT DEFAULT 'AERO PROTECT',
    ADD COLUMN IF NOT EXISTS show_watermark BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS use_auth BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS lua_code TEXT DEFAULT '';

-- ----------------------------------------------------------------------------
-- 3. License Keys Pool
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_string TEXT UNIQUE NOT NULL,
    script_id TEXT NOT NULL DEFAULT 'all',
    status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (status IN ('unclaimed', 'claimed', 'active', 'banned')),
    duration_hours INTEGER DEFAULT NULL,
    claimed_ip TEXT DEFAULT NULL,
    claimed_discord_id TEXT DEFAULT NULL,
    claimed_discord_tag TEXT DEFAULT NULL,
    claimed_at TIMESTAMPTZ DEFAULT NULL,
    activated_at TIMESTAMPTZ DEFAULT NULL,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    is_staff_review BOOLEAN DEFAULT FALSE,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migration for existing keys
ALTER TABLE public.keys
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.keys
    ADD COLUMN IF NOT EXISTS is_staff_review BOOLEAN DEFAULT FALSE;

ALTER TABLE public.keys
    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- 4. In-Game Sessions & Telemetry
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id TEXT DEFAULT NULL,
    script_id TEXT DEFAULT NULL,
    ip_address TEXT NOT NULL,
    hwid TEXT DEFAULT NULL,
    roblox_username TEXT DEFAULT NULL,
    roblox_user_id TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'kicked', 'tampered', 'expired', 'disconnected')),
    tamper_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    pending_commands JSONB NOT NULL DEFAULT '[]'::jsonb,
    session_started TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 5. Execution Logs (Analytics)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id TEXT DEFAULT NULL,
    script_name TEXT NOT NULL,
    roblox_username TEXT DEFAULT NULL,
    roblox_user_id TEXT DEFAULT NULL,
    ip_address TEXT NOT NULL,
    isp TEXT DEFAULT NULL,
    os TEXT DEFAULT NULL,
    executor TEXT DEFAULT NULL,
    key_last4 TEXT DEFAULT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    failure_reason TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 6. Checkpoint Logs (Funnel Tracking)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkpoint_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('started', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 7. Checkpoints Configuration
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkpoints (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL DEFAULT 'all',
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 5,
    "order" INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 8. Creator Profile (Guns.lol style)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
    display_name TEXT NOT NULL DEFAULT 'Revile',
    bio TEXT NOT NULL DEFAULT 'Lead Developer & Script Engineer. Building high-performance, tamper-protected scripts.',
    avatar_url TEXT NOT NULL DEFAULT 'https://api.dicebear.com/7.x/bottts/svg?seed=Revile21',
    emblems JSONB NOT NULL DEFAULT '[{"id":"1","label":"Verified Developer","icon":"verified","color":"#3b82f6"},{"id":"2","label":"Founder","icon":"crown","color":"#eab308"},{"id":"3","label":"Tamper Proof","icon":"shield","color":"#10b981"}]'::jsonb,
    socials JSONB NOT NULL DEFAULT '{"discord":"https://discord.gg/yourserver","youtube":"https://youtube.com/@revile","twitter":"https://x.com/revile","github":"https://github.com/"}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 9. Banned IPs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.banned_ips (
    ip_address TEXT PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT 'Manual ban or tamper detection',
    banned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 10. System Settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    claim_method TEXT NOT NULL DEFAULT 'checkpoints' CHECK (claim_method IN ('checkpoints', 'discord_oauth')),
    checkpoint_delay_seconds INTEGER NOT NULL DEFAULT 5,
    discord_guild_id TEXT DEFAULT '',
    discord_bot_token TEXT DEFAULT '',
    discord_invite_url TEXT DEFAULT 'https://discord.gg/yourserver',
    vpn_detection_enabled BOOLEAN NOT NULL DEFAULT true,
    tos_content TEXT NOT NULL DEFAULT '1. Acceptance of Terms: By obtaining or using any script or key from this service, you agree to these Terms.
2. No Tampering: Decompiling, reverse engineering, dumping bytecode, or bypassing heartbeat checks is strictly prohibited.
3. IP Binding: License keys are uniquely tied to the IP address and identity of the claimant. Sharing keys is not permitted.
4. Violations: Any violation results in an automatic, permanent IP and session ban without prior notice.',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- Safe Type Alterations & Foreign Key Relaxations for Existing Databases
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- Fix keys.script_id type if it was created as UUID with foreign key
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'keys' AND column_name = 'script_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.keys DROP CONSTRAINT IF EXISTS keys_script_id_fkey;
        ALTER TABLE public.keys ALTER COLUMN script_id TYPE TEXT USING script_id::text;
    END IF;

    -- Relax sessions foreign keys so deleting keys/scripts doesn't fail
    ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_key_id_fkey;
    ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_script_id_fkey;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'key_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.sessions ALTER COLUMN key_id TYPE TEXT USING key_id::text;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'script_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.sessions ALTER COLUMN script_id TYPE TEXT USING script_id::text;
    END IF;

    -- Relax execution_logs foreign key if present
    ALTER TABLE public.execution_logs DROP CONSTRAINT IF EXISTS execution_logs_script_id_fkey;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'execution_logs' AND column_name = 'script_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.execution_logs ALTER COLUMN script_id TYPE TEXT USING script_id::text;
    END IF;

    -- Relax checkpoints.id from uuid to text if present
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'checkpoints' AND column_name = 'id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.checkpoints ALTER COLUMN id TYPE TEXT USING id::text;
    END IF;

    -- Re-link loader_config_id foreign key safely with ON DELETE SET NULL
    ALTER TABLE public.scripts DROP CONSTRAINT IF EXISTS scripts_loader_config_id_fkey;
    ALTER TABLE public.scripts ADD CONSTRAINT scripts_loader_config_id_fkey FOREIGN KEY (loader_config_id) REFERENCES public.loader_configs(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- Default Seed Rows (Safe: ON CONFLICT DO NOTHING)
-- ----------------------------------------------------------------------------
INSERT INTO public.loader_configs (
    id, name, brand_name, title, accent_color, background_color, card_color, 
    text_color, subtext_color, corner_radius, frame_width, frame_height, 
    font_face, custom_subtitle, layout_positions
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Cyberpunk Cyan (Default)',
    'AERO LUA',
    'Script Authentication',
    '#00a2ff',
    '#16161e',
    '#21222e',
    '#ffffff',
    '#9ca3af',
    10,
    360,
    250,
    'GothamMedium',
    'Enter your license key below',
    '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.creator_profile (id, display_name, bio, avatar_url)
VALUES (
    1,
    'Revile',
    'Lead Developer & Script Engineer. Building high-performance, tamper-protected scripts.',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Revile21'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.system_settings (id, claim_method, checkpoint_delay_seconds)
VALUES (1, 'checkpoints', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.checkpoints (id, script_id, title, url, duration_seconds, "order")
VALUES 
    ('52097de7-6136-4da0-b9b9-f21612689848', 'all', 'Subscribe', 'https://www.youtube.com/@lollll-k5d', 10, 1),
    ('a5397f93-3f27-41b3-b68d-83ae68aa783b', 'all', 'Like the video', 'https://www.youtube.com/watch?v=Z6DbPPkLlq4', 45, 2),
    ('add593ab-7e23-45a8-9d57-798c4cb0b9cd', 'all', 'Join the discord', 'https://discord.gg/AeCYnnQmq5', 45, 3)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Enable Realtime for Live Telemetry
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.execution_logs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.keys;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scripts;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
