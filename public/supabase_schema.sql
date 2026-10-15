-- ============================================================================
-- Lua Auth & Script Endpoint - Supabase Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Loader UI Configurations
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
    webhook_enabled BOOLEAN NOT NULL DEFAULT false,
    webhook_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Modular Scripts Vault
CREATE TABLE IF NOT EXISTS public.scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    entry_file TEXT NOT NULL,
    modules JSONB NOT NULL DEFAULT '{}'::jsonb,
    loader_config_id UUID REFERENCES public.loader_configs(id) ON DELETE SET NULL,
    watermark_text TEXT NOT NULL DEFAULT 'AERO PROTECT',
    show_watermark BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Key Pools & Keys
CREATE TABLE IF NOT EXISTS public.keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_string TEXT UNIQUE NOT NULL,
    script_id UUID REFERENCES public.scripts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (status IN ('unclaimed', 'claimed', 'active', 'banned')),
    duration_hours INTEGER DEFAULT NULL,
    claimed_ip TEXT DEFAULT NULL,
    claimed_discord_id TEXT DEFAULT NULL,
    claimed_discord_tag TEXT DEFAULT NULL,
    claimed_at TIMESTAMPTZ DEFAULT NULL,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    is_staff_review BOOLEAN DEFAULT FALSE,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. In-Game Sessions & 1s Heartbeat Telemetry
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id UUID REFERENCES public.keys(id) ON DELETE CASCADE,
    script_id UUID REFERENCES public.scripts(id) ON DELETE CASCADE,
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

-- 5. Execution Logs (Analytics)
CREATE TABLE IF NOT EXISTS public.execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES public.scripts(id) ON DELETE SET NULL,
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

-- 6. Checkpoint Logs (Funnel Analytics)
CREATE TABLE IF NOT EXISTS public.checkpoint_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('started', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Banned IPs & HWIDs
CREATE TABLE IF NOT EXISTS public.banned_ips (
    ip_address TEXT PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT 'Manual ban or tamper detection',
    banned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    claim_method TEXT NOT NULL DEFAULT 'checkpoints' CHECK (claim_method IN ('checkpoints', 'discord_oauth')),
    checkpoint_delay_seconds INTEGER NOT NULL DEFAULT 10,
    discord_guild_id TEXT DEFAULT NULL,
    discord_bot_token TEXT DEFAULT NULL,
    discord_invite_url TEXT DEFAULT 'https://discord.gg/',
    vpn_detection_enabled BOOLEAN NOT NULL DEFAULT true,
    tos_content TEXT NOT NULL DEFAULT '1. Reverse engineering, decompiling, or tampering with scripts is strictly prohibited.\n2. Keys are non-transferable and bound to your IP.\n3. Misuse will lead to an immediate hardware and IP ban.',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.system_settings (id, claim_method, checkpoint_delay_seconds, vpn_detection_enabled)
VALUES (1, 'checkpoints', 10, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.loader_configs (id, name, brand_name, title, accent_color, background_color, card_color, text_color, subtext_color, corner_radius, frame_width, frame_height)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Cyberpunk Dark (Default)',
    'SYNAPSE AERO',
    'Key System',
    '#00a2ff',
    '#18181f',
    '#22222b',
    '#ffffff',
    '#9ca3af',
    10,
    360,
    250
)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_keys_keystring ON public.keys(key_string);
CREATE INDEX IF NOT EXISTS idx_sessions_last_heartbeat ON public.sessions(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_execution_logs_created_at ON public.execution_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_checkpoint_logs_created_at ON public.checkpoint_logs(created_at);

-- 9. Checkpoints Gate
CREATE TABLE IF NOT EXISTS public.checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id TEXT NOT NULL DEFAULT 'all',
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 5,
    "order" INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Creator Profile (Guns.lol style)
CREATE TABLE IF NOT EXISTS public.creator_profiles (
    id INTEGER PRIMARY KEY DEFAULT 1,
    display_name TEXT NOT NULL DEFAULT 'Revile',
    bio TEXT NOT NULL DEFAULT 'Lead Developer & Script Engineer.',
    avatar_url TEXT NOT NULL DEFAULT 'https://api.dicebear.com/7.x/bottts/svg?seed=Revile21',
    emblems JSONB NOT NULL DEFAULT '[]'::jsonb,
    socials JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Staff Review Sessions & History (Zero user tracking, review duration and script telemetry only)
CREATE TABLE IF NOT EXISTS public.staff_reviews (
    id TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    script_id TEXT NOT NULL,
    script_name TEXT NOT NULL,
    key_label TEXT NOT NULL DEFAULT 'Staff Key',
    status TEXT NOT NULL DEFAULT 'reviewing',
    review_started TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_staff_reviews_started ON public.staff_reviews(review_started);

