-- ============================================================================
-- ATOMPROTECT / AERO AUTH: UNIFIED MOBILE & WEB BACKEND DATABASE SCHEMA
-- ============================================================================
-- Complete, production-grade PostgreSQL migration for Supabase.
-- Compatible with fresh setups AND seamlessly migrates existing tables.
-- Run directly in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Automatic Timestamp Update Trigger Function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Mobile App Devices & Push Notification Tokens (FCM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mobile_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT NOT NULL DEFAULT 'admin',
    device_token TEXT UNIQUE NOT NULL,
    device_name TEXT,
    platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'web')),
    fcm_push_token TEXT,
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    notify_on_bypass BOOLEAN NOT NULL DEFAULT true,
    notify_on_alt_farm BOOLEAN NOT NULL DEFAULT true,
    notify_on_new_dm BOOLEAN NOT NULL DEFAULT true,
    notify_on_error BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_token ON public.mobile_devices(device_token);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_fcm ON public.mobile_devices(fcm_push_token);

-- ============================================================================
-- 3. Mobile Admin Sessions & Authentication Audits
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT UNIQUE NOT NULL,
    admin_username TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON public.admin_sessions(is_active, expires_at DESC);

-- ============================================================================
-- 4. Mobile & Dashboard In-App Notifications Feed
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('tamper_alert', 'bypass_lockout', 'alt_farm_detected', 'new_dm', 'client_error', 'system_event')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON public.admin_notifications(read, created_at DESC);

-- ============================================================================
-- 5. In-Game Auth Loader UI Configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loader_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand_name TEXT NOT NULL DEFAULT 'ATOMPROTECT',
    title TEXT NOT NULL DEFAULT 'Script Authentication',
    accent_color TEXT NOT NULL DEFAULT '#00a2ff',
    background_color TEXT NOT NULL DEFAULT '#16161e',
    card_color TEXT NOT NULL DEFAULT '#21222e',
    text_color TEXT NOT NULL DEFAULT '#ffffff',
    subtext_color TEXT NOT NULL DEFAULT '#9ca3af',
    corner_radius INTEGER NOT NULL DEFAULT 10,
    frame_width INTEGER NOT NULL DEFAULT 360,
    frame_height INTEGER NOT NULL DEFAULT 250,
    font_face TEXT NOT NULL DEFAULT 'GothamMedium',
    show_brand_icon BOOLEAN NOT NULL DEFAULT true,
    custom_subtitle TEXT NOT NULL DEFAULT 'Enter your license key below',
    key_placeholder TEXT DEFAULT 'Paste your license key here...',
    verify_button_text TEXT DEFAULT 'VERIFY KEY',
    claim_button_text TEXT DEFAULT 'CLAIM YOUR KEY (COPY LINK)',
    show_discord_button BOOLEAN DEFAULT false,
    discord_button_text TEXT DEFAULT 'JOIN DISCORD',
    discord_invite_url TEXT DEFAULT 'https://discord.gg/kGtqH3k2wN',
    show_watermark BOOLEAN DEFAULT true,
    watermark_text TEXT DEFAULT 'ATOMPROTECT',
    status_verifying TEXT DEFAULT 'Checking license key...',
    status_verified TEXT DEFAULT 'Access Granted! Loading script...',
    status_expired TEXT DEFAULT 'License key expired or invalid.',
    status_error TEXT DEFAULT 'Verification failed. Check network or key.',
    logo_url TEXT DEFAULT '',
    show_logo BOOLEAN DEFAULT false,
    layout_positions JSONB DEFAULT '{}'::jsonb,
    webhook_enabled BOOLEAN NOT NULL DEFAULT false,
    webhook_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for loader_configs
DROP TRIGGER IF EXISTS trg_loader_configs_updated_at ON public.loader_configs;
CREATE TRIGGER trg_loader_configs_updated_at
BEFORE UPDATE ON public.loader_configs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 6. Modular Luau Scripts Vault & Maintenance Kill-Switch
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    entry_file TEXT NOT NULL DEFAULT 'main.lua',
    modules JSONB NOT NULL DEFAULT '{}'::jsonb,
    loader_config_id UUID REFERENCES public.loader_configs(id) ON DELETE SET NULL,
    watermark_text TEXT NOT NULL DEFAULT 'ATOMPROTECT',
    show_watermark BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    use_auth BOOLEAN NOT NULL DEFAULT true,
    is_maintenance BOOLEAN NOT NULL DEFAULT false,
    maintenance_message TEXT DEFAULT NULL,
    lua_code TEXT DEFAULT '',
    github_repo TEXT DEFAULT NULL,
    github_branch TEXT DEFAULT 'main',
    github_directory TEXT DEFAULT NULL,
    github_token TEXT DEFAULT NULL,
    github_auto_pull BOOLEAN NOT NULL DEFAULT false,
    github_last_commit TEXT DEFAULT NULL,
    github_last_pulled_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_scripts_slug ON public.scripts(slug);
CREATE INDEX IF NOT EXISTS idx_scripts_active ON public.scripts(is_active);

-- Trigger for scripts
DROP TRIGGER IF EXISTS trg_scripts_updated_at ON public.scripts;
CREATE TRIGGER trg_scripts_updated_at
BEFORE UPDATE ON public.scripts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 7. License Keys Pool (Staff Keys, HWID/IP Locks, Durations)
-- ============================================================================
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
    is_staff_review BOOLEAN NOT NULL DEFAULT false,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_keys_string ON public.keys(key_string);
CREATE INDEX IF NOT EXISTS idx_keys_status ON public.keys(status);
CREATE INDEX IF NOT EXISTS idx_keys_claimed_ip ON public.keys(claimed_ip);
CREATE INDEX IF NOT EXISTS idx_keys_script_id ON public.keys(script_id);
CREATE INDEX IF NOT EXISTS idx_keys_expires_at ON public.keys(expires_at);

-- ============================================================================
-- 8. Live In-Game Sessions & Telemetry
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id TEXT DEFAULT NULL,
    script_id TEXT DEFAULT NULL,
    ip_address TEXT NOT NULL,
    hwid TEXT DEFAULT NULL,
    roblox_username TEXT DEFAULT NULL,
    roblox_user_id TEXT DEFAULT NULL,
    avatar_url TEXT DEFAULT NULL,
    place_id TEXT DEFAULT NULL,
    place_name TEXT DEFAULT NULL,
    job_id TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('loading', 'active', 'kicked', 'tampered', 'expired', 'disconnected')),
    loader_token TEXT DEFAULT NULL,
    executor TEXT DEFAULT NULL,
    tamper_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    pending_commands JSONB NOT NULL DEFAULT '[]'::jsonb,
    country TEXT DEFAULT NULL,
    city TEXT DEFAULT NULL,
    latitude DOUBLE PRECISION DEFAULT NULL,
    longitude DOUBLE PRECISION DEFAULT NULL,
    session_started TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_sessions_status_heartbeat ON public.sessions(status, last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_ip ON public.sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_sessions_hwid ON public.sessions(hwid);
CREATE INDEX IF NOT EXISTS idx_sessions_username ON public.sessions(roblox_username);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(roblox_user_id);

-- ============================================================================
-- 9. Remote Commands Queue & Historical Audit Log (Kick, Message, Code, Teleport)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.session_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    command_type TEXT NOT NULL CHECK (command_type IN ('kick', 'message', 'announcement', 'execute_code', 'teleport')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'executed', 'failed')),
    created_by TEXT NOT NULL DEFAULT 'admin',
    executed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_session_commands_session ON public.session_commands(session_id, status);

-- ============================================================================
-- 10. Execution Logs & Global Geo-Analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id TEXT DEFAULT NULL,
    script_name TEXT NOT NULL,
    roblox_username TEXT DEFAULT NULL,
    roblox_user_id TEXT DEFAULT NULL,
    avatar_url TEXT DEFAULT NULL,
    place_id TEXT DEFAULT NULL,
    place_name TEXT DEFAULT NULL,
    job_id TEXT DEFAULT NULL,
    ip_address TEXT NOT NULL,
    isp TEXT DEFAULT NULL,
    os TEXT DEFAULT NULL,
    executor TEXT DEFAULT NULL,
    key_last4 TEXT DEFAULT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    failure_reason TEXT DEFAULT NULL,
    country TEXT DEFAULT NULL,
    city TEXT DEFAULT NULL,
    latitude DOUBLE PRECISION DEFAULT NULL,
    longitude DOUBLE PRECISION DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_execution_logs_created ON public.execution_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_logs_script ON public.execution_logs(script_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON public.execution_logs(status);

-- ============================================================================
-- 11. Client Runtime Errors & Luau Crash Telemetry
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_errors (
    id TEXT PRIMARY KEY,
    session_id TEXT DEFAULT NULL,
    script_id TEXT DEFAULT NULL,
    script_name TEXT DEFAULT NULL,
    roblox_username TEXT DEFAULT NULL,
    roblox_user_id TEXT DEFAULT NULL,
    executor TEXT DEFAULT NULL,
    os TEXT DEFAULT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_client_errors_script ON public.client_errors(script_id);
CREATE INDEX IF NOT EXISTS idx_client_errors_created ON public.client_errors(created_at DESC);

-- ============================================================================
-- 12. Global In-Game Broadcast Announcements
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.global_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id TEXT NOT NULL DEFAULT 'all',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 13. Checkpoint Steps Configuration (Monetization Gateway)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.checkpoints (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL DEFAULT 'all',
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 5,
    "order" INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_checkpoints_order ON public.checkpoints("order" ASC);

-- ============================================================================
-- 14. Checkpoint Conversion Funnel Logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.checkpoint_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id TEXT DEFAULT NULL,
    ip_address TEXT NOT NULL,
    stage TEXT NOT NULL,
    step_index INTEGER DEFAULT NULL,
    checkpoint_title TEXT DEFAULT NULL,
    session_id TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_checkpoint_logs_stage ON public.checkpoint_logs(stage, created_at DESC);

-- ============================================================================
-- 15. Checkpoint Bypass Lockouts (Scraper Detection Watchdog)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bypass_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    hwid TEXT DEFAULT NULL,
    script_id TEXT DEFAULT NULL,
    step_index INTEGER DEFAULT NULL,
    reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_bypass_attempts_ip ON public.bypass_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_bypass_attempts_hwid ON public.bypass_attempts(hwid);
CREATE INDEX IF NOT EXISTS idx_bypass_attempts_created ON public.bypass_attempts(created_at DESC);

-- ============================================================================
-- 16. Permanent IP and HWID Blacklists
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.banned_ips (
    ip_address TEXT PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT 'Manual ban or tamper detection',
    banned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.banned_hwids (
    hwid TEXT PRIMARY KEY,
    ip_address TEXT,
    reason TEXT NOT NULL DEFAULT 'Bypass attempts exceeded threshold (3x)',
    banned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_banned_hwids_banned_at ON public.banned_hwids(banned_at DESC);

-- ============================================================================
-- 17. Creator Public Profile (Guns.lol styling & badges)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.creator_profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
    display_name TEXT NOT NULL DEFAULT 'Revile',
    bio TEXT NOT NULL DEFAULT 'Lead Developer & Script Engineer. Building high-performance, tamper-protected scripts.',
    avatar_url TEXT NOT NULL DEFAULT 'https://api.dicebear.com/7.x/bottts/svg?seed=Revile21',
    raw_avatar_url TEXT DEFAULT NULL,
    accent_color TEXT DEFAULT '#00a2ff',
    emblems JSONB NOT NULL DEFAULT '[{"id":"1","label":"Verified Developer","icon":"verified","color":"#3b82f6"},{"id":"2","label":"Founder","icon":"crown","color":"#eab308"},{"id":"3","label":"Tamper Proof","icon":"shield","color":"#10b981"}]'::jsonb,
    socials JSONB NOT NULL DEFAULT '{"discord":"https://discord.gg/kGtqH3k2wN","youtube":"https://youtube.com/@revile","twitter":"https://x.com/revile","github":"https://github.com/"}'::jsonb,
    social_toggles JSONB NOT NULL DEFAULT '{}'::jsonb,
    badge_toggles JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for creator_profile
DROP TRIGGER IF EXISTS trg_creator_profile_updated_at ON public.creator_profile;
CREATE TRIGGER trg_creator_profile_updated_at
BEFORE UPDATE ON public.creator_profile
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 18. Global Chatroom & Developer Direct Messages (DMs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chatroom_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    message TEXT NOT NULL,
    is_dev BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_chatroom_messages_created ON public.chatroom_messages(created_at ASC);

CREATE TABLE IF NOT EXISTS public.chatroom_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_chatroom_blacklist_word ON public.chatroom_blacklist(word);

CREATE TABLE IF NOT EXISTS public.dev_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'dev')),
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_dev_messages_user_created ON public.dev_messages(user_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dev_messages_unread ON public.dev_messages(read) WHERE read = false;

-- ============================================================================
-- 19. Staff Review Sessions & History
-- ============================================================================
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
CREATE INDEX IF NOT EXISTS idx_staff_reviews_started ON public.staff_reviews(review_started DESC);

-- ============================================================================
-- 20. System Global Settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    claim_method TEXT NOT NULL DEFAULT 'checkpoints' CHECK (claim_method IN ('checkpoints', 'discord_oauth')),
    checkpoint_delay_seconds INTEGER NOT NULL DEFAULT 5,
    discord_guild_id TEXT DEFAULT '',
    discord_bot_token TEXT DEFAULT '',
    discord_invite_url TEXT DEFAULT 'https://discord.gg/kGtqH3k2wN',
    vpn_detection_enabled BOOLEAN NOT NULL DEFAULT true,
    chatroom_cooldown_seconds INTEGER NOT NULL DEFAULT 3,
    tos_content TEXT NOT NULL DEFAULT '1. Acceptance of Terms: By obtaining or using any script or key from this service, you agree to these Terms.
2. No Tampering: Decompiling, reverse engineering, dumping bytecode, or bypassing heartbeat checks is strictly prohibited.
3. IP Binding: License keys are uniquely tied to the IP address and identity of the claimant. Sharing keys is not permitted.
4. Violations: Any violation results in an automatic, permanent IP and session ban without prior notice.',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger for system_settings
DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 21. Database Stored Procedures & Cleanup Functions
-- ============================================================================

-- A. Mark Stale Sessions as Disconnected (e.g. heartbeat > 90 seconds)
CREATE OR REPLACE FUNCTION public.mark_stale_sessions(timeout_ms INTEGER DEFAULT 90000)
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
    cutoff_time TIMESTAMPTZ;
BEGIN
    cutoff_time = timezone('utc'::text, now()) - (timeout_ms || ' milliseconds')::interval;
    
    UPDATE public.sessions
    SET status = 'disconnected'
    WHERE status = 'active'
      AND last_heartbeat < cutoff_time;
      
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- B. Automatically Purge Expired License Keys
CREATE OR REPLACE FUNCTION public.purge_expired_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.keys
    WHERE expires_at IS NOT NULL
      AND expires_at < timezone('utc'::text, now())
      AND is_staff_review = false;
      
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- C. High-Speed Mobile Dashboard Overview Function (Aggregated in 1 Query)
CREATE OR REPLACE FUNCTION public.get_mobile_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    active_players INTEGER;
    total_keys INTEGER;
    active_keys INTEGER;
    banned_ips_count INTEGER;
    unread_dms INTEGER;
    recent_errors INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_players FROM public.sessions WHERE status = 'active' AND last_heartbeat > (timezone('utc'::text, now()) - INTERVAL '35 seconds');
    SELECT COUNT(*) INTO total_keys FROM public.keys;
    SELECT COUNT(*) INTO active_keys FROM public.keys WHERE status = 'active';
    SELECT COUNT(*) INTO banned_ips_count FROM public.banned_ips;
    SELECT COUNT(*) INTO unread_dms FROM public.dev_messages WHERE read = false AND sender_type = 'user';
    SELECT COUNT(*) INTO recent_errors FROM public.client_errors WHERE created_at > (timezone('utc'::text, now()) - INTERVAL '24 hours');
    
    RETURN jsonb_build_object(
        'active_players', active_players,
        'total_keys', total_keys,
        'active_keys', active_keys,
        'banned_ips', banned_ips_count,
        'unread_dms', unread_dms,
        'recent_errors_24h', recent_errors,
        'server_time', timezone('utc'::text, now())
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 22. Supabase Realtime Publication Setup
-- ============================================================================
DO $$
BEGIN
    -- Enable realtime for live mobile push and web dashboards
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_commands;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dev_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chatroom_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_errors;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bypass_attempts;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.keys;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scripts;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ============================================================================
-- 23. Row Level Security (RLS) Policies
-- ============================================================================
ALTER TABLE public.mobile_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loader_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bypass_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_hwids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatroom_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatroom_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Grant Full Service Role & Authenticated Access
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'mobile_devices', 'admin_sessions', 'admin_notifications', 'loader_configs', 
        'scripts', 'keys', 'sessions', 'session_commands', 'execution_logs', 
        'client_errors', 'global_announcements', 'checkpoints', 'checkpoint_logs', 
        'bypass_attempts', 'banned_ips', 'banned_hwids', 'creator_profile', 
        'chatroom_messages', 'chatroom_blacklist', 'dev_messages', 'staff_reviews', 
        'system_settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Full access policy on %I" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Full access policy on %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
    END LOOP;
END $$;

-- ============================================================================
-- 24. Safe Seed Rows (Idempotent: ON CONFLICT DO NOTHING)
-- ============================================================================
INSERT INTO public.loader_configs (
    id, name, brand_name, title, accent_color, background_color, card_color, 
    text_color, subtext_color, corner_radius, frame_width, frame_height, 
    font_face, custom_subtitle, layout_positions
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Dark Cyberpunk (Default)',
    'ATOMPROTECT',
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
    ('52097de7-6136-4da0-b9b9-f21612689848', 'all', 'Subscribe on YouTube', 'https://www.youtube.com/@lollll-k5d', 10, 1),
    ('a5397f93-3f27-41b3-b68d-83ae68aa783b', 'all', 'Like & Comment Video', 'https://www.youtube.com/watch?v=Z6DbPPkLlq4', 45, 2),
    ('add593ab-7e23-45a8-9d57-798c4cb0b9cd', 'all', 'Join Community Discord', 'https://discord.gg/kGtqH3k2wN', 45, 3)
ON CONFLICT (id) DO NOTHING;
