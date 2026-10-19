// lib/store.ts
import fs from "fs";
import path from "path";
import { supabase, isSupabaseConfigured } from "./supabase";
import { normalizeIp } from "./ip";

export interface LoaderConfigRecord {
  id: string;
  name: string;
  brand_name: string;
  title: string;
  accent_color: string;
  background_color: string;
  card_color: string;
  text_color: string;
  subtext_color: string;
  corner_radius: number;
  frame_width: number;
  frame_height: number;
  font_face: string;
  custom_subtitle: string;
  key_placeholder?: string;
  verify_button_text?: string;
  claim_button_text?: string;
  show_discord_button?: boolean;
  discord_button_text?: string;
  discord_invite_url?: string;
  show_watermark?: boolean;
  watermark_text?: string;
  status_verifying?: string;
  status_verified?: string;
  status_expired?: string;
  status_error?: string;
  logo_url?: string;
  show_logo?: boolean;
  webhook_enabled?: boolean;
  webhook_url?: string;
  layout_positions?: Record<string, { x: number; y: number; w?: number; h?: number }>;
  created_at: string;
  updated_at: string;
}

export interface ScriptRecord {
  id: string;
  name: string;
  slug: string;
  entry_file: string;
  modules: Record<string, string>; // { "main.lua": "...", "combat.lua": "..." }
  loader_config_id?: string | null;
  watermark_text: string;
  show_watermark: boolean;
  is_active: boolean;
  use_auth?: boolean; // If true, requires auth loader and license key. If false, executes directly without key.
  is_maintenance?: boolean; // Maintenance Mode Kill-Switch
  maintenance_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeyRecord {
  id: string;
  key_string: string;
  script_id: string;
  status: "unclaimed" | "claimed" | "active" | "banned";
  duration_hours: number | null;
  claimed_ip: string | null;
  claimed_discord_id: string | null;
  claimed_discord_tag: string | null;
  claimed_at: string | null;
  activated_at?: string | null;
  expires_at: string | null;
  created_at: string;
  is_staff_review?: boolean;
  notes?: string | null;
}

export function isStaffReviewKey(k: KeyRecord | null | undefined): boolean {
  if (!k) return false;
  return (
    k.is_staff_review === true ||
    k.claimed_discord_tag === "STAFF_REVIEW" ||
    k.claimed_discord_id === "STAFF_REVIEW" ||
    k.key_string.startsWith("STAFF-") ||
    k.key_string.startsWith("STAFF_")
  );
}

export interface SessionCommand {
  id: string;
  type: "kick" | "message" | "announcement" | "execute_code" | "teleport";
  reason?: string;
  message?: string;
  title?: string;
  code?: string;
  place_id?: number | string;
  server_hop?: boolean;
  duration_seconds?: number;
}

export interface GlobalAnnouncement {
  id: string;
  script_id: string; // "all" or specific script ID
  title: string;
  message: string;
  duration_seconds: number;
  created_at: string;
}

export interface SessionRecord {
  id: string;
  key_id: string;
  script_id: string;
  ip_address: string;
  hwid: string | null;
  roblox_username: string | null;
  roblox_user_id: string | null;
  avatar_url?: string | null;
  place_id?: string | null;
  place_name?: string | null;
  job_id?: string | null;
  status: "active" | "kicked" | "tampered" | "expired" | "disconnected";
  tamper_flags: string[];
  pending_commands: SessionCommand[];
  session_started: string;
  last_heartbeat: string;
  created_at: string;
}

export interface ClientErrorLog {
  id: string;
  session_id?: string | null;
  script_id?: string | null;
  script_name?: string | null;
  roblox_username?: string | null;
  roblox_user_id?: string | null;
  executor?: string | null;
  os?: string | null;
  error_message: string;
  stack_trace?: string | null;
  created_at: string;
}

export interface ExecutionLog {
  id: string;
  script_id: string;
  script_name: string;
  roblox_username: string | null;
  roblox_user_id: string | null;
  avatar_url?: string | null;
  ip_address: string;
  isp: string | null;
  os: string | null;
  executor: string | null;
  place_id?: string | null;
  place_name?: string | null;
  job_id?: string | null;
  key_last4: string | null;
  status: "success" | "failed";
  failure_reason: string | null;
  created_at: string;
}

export interface CheckpointLog {
  id: string;
  script_id?: string;
  ip_address: string;
  stage: "started" | "completed";
  created_at: string;
}

export interface CheckpointItem {
  id: string;
  script_id: string; // "all" or specific script ID
  title: string;
  url: string;
  duration_seconds: number;
  order: number;
  created_at: string;
}

export interface CreatorEmblem {
  id: string;
  label: string;
  icon: string; // "verified" | "crown" | "shield" | "flame" | "star" | "zap" | "skull"
  color?: string;
}

export interface CreatorProfile {
  display_name: string;
  bio: string;
  avatar_url: string;
  raw_avatar_url?: string;
  accent_color?: string;
  emblems: CreatorEmblem[];
  socials: {
    discord?: string;
    youtube?: string;
    x?: string;
    twitter?: string;
    github?: string;
    tiktok?: string;
    cashapp?: string;
    paypal?: string;
    spotify?: string;
    roblox?: string;
    telegram?: string;
  };
  social_toggles?: Record<string, boolean>;
  badge_toggles?: Record<string, boolean>;
}

export interface SystemSettings {
  claim_method: "checkpoints" | "discord_oauth";
  checkpoint_delay_seconds: number;
  discord_guild_id: string;
  discord_bot_token: string;
  discord_invite_url: string;
  vpn_detection_enabled: boolean;
  tos_content: string;
}

export interface StaffReviewRecord {
  id: string;
  key_id: string;
  script_id: string;
  script_name: string;
  key_label: string;
  status: "reviewing" | "completed";
  review_started: string;
  last_heartbeat: string;
  duration_seconds: number;
  created_at: string;
}

interface LocalDatabase {
  loader_configs: LoaderConfigRecord[];
  scripts: ScriptRecord[];
  keys: KeyRecord[];
  sessions: SessionRecord[];
  execution_logs: ExecutionLog[];
  checkpoint_logs: CheckpointLog[];
  checkpoints: CheckpointItem[];
  creator_profile: CreatorProfile;
  banned_ips: Record<string, { reason: string; banned_at: string }>;
  settings: SystemSettings;
  staff_reviews: StaffReviewRecord[];
  global_announcements: GlobalAnnouncement[];
  client_errors: ClientErrorLog[];
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

const defaultLoaderConfig: LoaderConfigRecord = {
  id: "a0000000-0000-0000-0000-000000000001",
  name: "AtomProtect Dark (Default)",
  brand_name: "AtomProtect",
  title: "Key System",
  accent_color: "#00a2ff",
  background_color: "#16161e",
  card_color: "#21222e",
  text_color: "#ffffff",
  subtext_color: "#9ca3af",
  corner_radius: 10,
  frame_width: 360,
  frame_height: 250,
  font_face: "GothamMedium",
  custom_subtitle: "Enter your license key below",
  key_placeholder: "Paste your license key here...",
  verify_button_text: "VERIFY KEY",
  claim_button_text: "GET KEY (COPY LINK)",
  show_discord_button: false,
  discord_button_text: "JOIN DISCORD",
  discord_invite_url: "https://discord.gg/AeCYnnQmq5",
  show_watermark: true,
  watermark_text: "AtomProtect",
  status_verifying: "Verifying key with server...",
  status_verified: "Verified! Launching script...",
  status_expired: "Key expired. Please get a new key.",
  status_error: "Verification failed. Check your key.",
  webhook_enabled: false,
  webhook_url: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const defaultCreatorProfile: CreatorProfile = {
  display_name: "Revile",
  bio: "Lead Developer & Script Engineer. Building high-performance, tamper-protected scripts.",
  avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=Revile21",
  emblems: [
    { id: "1", label: "Verified Developer", icon: "verified", color: "#3b82f6" },
    { id: "2", label: "Founder", icon: "crown", color: "#eab308" },
    { id: "3", label: "Tamper Proof", icon: "shield", color: "#10b981" },
  ],
  socials: {
    discord: "https://discord.gg/AeCYnnQmq5",
    youtube: "https://youtube.com/@revile",
    twitter: "https://x.com/revile",
    github: "https://github.com/",
    tiktok: "",
    roblox: "",
    telegram: "",
  },
};

const defaultCheckpoints: CheckpointItem[] = [
  {
    id: "c0000000-0000-0000-0000-000000000001",
    script_id: "all",
    title: "Visit Community Portal",
    url: "https://discord.gg/AeCYnnQmq5",
    duration_seconds: 5,
    order: 1,
    created_at: new Date().toISOString(),
  },
];

const initialDb: LocalDatabase = {
  loader_configs: [defaultLoaderConfig],
  scripts: [],
  keys: [],
  sessions: [],
  execution_logs: [],
  checkpoint_logs: [],
  checkpoints: defaultCheckpoints,
  creator_profile: defaultCreatorProfile,
  banned_ips: {},
  settings: {
    claim_method: "checkpoints",
    checkpoint_delay_seconds: 5,
    discord_guild_id: "",
    discord_bot_token: "",
    discord_invite_url: "https://discord.gg/AeCYnnQmq5",
    vpn_detection_enabled: true,
    tos_content: `1. Acceptance of Terms: By obtaining or using any script or key from this service, you agree to these Terms.\n2. No Tampering: Decompiling, reverse engineering, dumping bytecode, or bypassing heartbeat checks is strictly prohibited.\n3. IP Binding: License keys are uniquely tied to the IP address and identity of the claimant. Sharing keys is not permitted.\n4. Violations: Any violation results in an automatic, permanent IP and session ban without prior notice.`,
  },
  staff_reviews: [],
  global_announcements: [],
  client_errors: [],
};

const DB_BACKUP_FILE = path.join(DB_DIR, "db.json.bak");
let inMemoryDbCache: LocalDatabase | null = null;

function readLocalDb(): LocalDatabase {
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf8");
      inMemoryDbCache = initialDb;
      return initialDb;
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    if (!raw.trim()) {
      if (inMemoryDbCache) return inMemoryDbCache;
    }
    const data = JSON.parse(raw);
    const parsed: LocalDatabase = {
      ...initialDb,
      ...data,
      execution_logs: data.execution_logs || [],
      checkpoint_logs: data.checkpoint_logs || [],
      checkpoints: data.checkpoints && data.checkpoints.length > 0 ? data.checkpoints : defaultCheckpoints,
      creator_profile: data.creator_profile ? { ...defaultCreatorProfile, ...data.creator_profile } : defaultCreatorProfile,
      staff_reviews: data.staff_reviews || [],
      global_announcements: data.global_announcements || [],
      client_errors: data.client_errors || [],
    };
    inMemoryDbCache = parsed;
    return parsed;
  } catch (err) {
    console.error("Error reading local db, falling back to memory cache or backup", err);
    if (inMemoryDbCache) {
      return inMemoryDbCache;
    }
    try {
      if (fs.existsSync(DB_BACKUP_FILE)) {
        const backupRaw = fs.readFileSync(DB_BACKUP_FILE, "utf8");
        const backupData = JSON.parse(backupRaw);
        inMemoryDbCache = backupData;
        return backupData;
      }
    } catch {
      // fallback to initialDb
    }
    return initialDb;
  }
}

function writeLocalDb(db: LocalDatabase) {
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    inMemoryDbCache = db;
    const tempFile = path.join(DB_DIR, `db.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    const json = JSON.stringify(db, null, 2);
    fs.writeFileSync(tempFile, json, "utf8");
    try {
      fs.renameSync(tempFile, DB_FILE);
    } catch {
      // Fallback on Windows if rename encounters temporary file lock
      fs.copyFileSync(tempFile, DB_FILE);
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
    try {
      fs.copyFileSync(DB_FILE, DB_BACKUP_FILE);
    } catch {}
  } catch (err) {
    console.error("Error writing local db", err);
  }
}

function getTimeCutoff(timeframe?: string): number {
  const now = Date.now();
  if (timeframe === "day") return now - 24 * 60 * 60 * 1000;
  if (timeframe === "week") return now - 7 * 24 * 60 * 60 * 1000;
  if (timeframe === "month") return now - 30 * 24 * 60 * 60 * 1000;
  if (timeframe === "year") return now - 365 * 24 * 60 * 60 * 1000;
  return 0; // all time
}

export const dbService = {
  // Loader configs
  async getLoaderConfigs(): Promise<LoaderConfigRecord[]> {
    const localConfigs = readLocalDb().loader_configs;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from("loader_configs").select("*").order("created_at", { ascending: false });
        if (data && data.length > 0 && !error) {
          return data.map((remote) => {
            const local = localConfigs.find((l) => l.id === remote.id);
            return {
              ...local,
              ...remote,
              layout_positions: remote.layout_positions || local?.layout_positions,
              key_placeholder: remote.key_placeholder || local?.key_placeholder,
              verify_button_text: remote.verify_button_text || local?.verify_button_text,
              claim_button_text: remote.claim_button_text || local?.claim_button_text,
              show_discord_button: remote.show_discord_button ?? local?.show_discord_button,
              discord_button_text: remote.discord_button_text || local?.discord_button_text,
              discord_invite_url: remote.discord_invite_url || local?.discord_invite_url,
              show_watermark: remote.show_watermark ?? local?.show_watermark,
              watermark_text: remote.watermark_text || local?.watermark_text,
            };
          });
        }
      } catch (e) {
        console.error("Supabase getLoaderConfigs error:", e);
      }
    }
    return localConfigs;
  },

  async getLoaderConfigById(id: string): Promise<LoaderConfigRecord | null> {
    const local = readLocalDb().loader_configs.find((c) => c.id === id) || null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from("loader_configs").select("*").eq("id", id).maybeSingle();
        if (data) {
          return {
            ...local,
            ...data,
            layout_positions: data.layout_positions || local?.layout_positions,
            key_placeholder: data.key_placeholder || local?.key_placeholder,
            verify_button_text: data.verify_button_text || local?.verify_button_text,
            claim_button_text: data.claim_button_text || local?.claim_button_text,
            show_discord_button: data.show_discord_button ?? local?.show_discord_button,
            discord_button_text: data.discord_button_text || local?.discord_button_text,
            discord_invite_url: data.discord_invite_url || local?.discord_invite_url,
            show_watermark: data.show_watermark ?? local?.show_watermark,
            watermark_text: data.watermark_text || local?.watermark_text,
          };
        }
      } catch (err) {
        console.error("Supabase getLoaderConfigById error:", err);
      }
    }
    return local;
  },

  async saveLoaderConfig(config: Omit<LoaderConfigRecord, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<LoaderConfigRecord> {
    const id = config.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record: LoaderConfigRecord = {
      ...config,
      id,
      created_at: now,
      updated_at: now,
    };

    // Always persist to local DB first
    const db = readLocalDb();
    const index = db.loader_configs.findIndex((c) => c.id === id);
    if (index >= 0) db.loader_configs[index] = record;
    else db.loader_configs.unshift(record);
    writeLocalDb(db);

    // Save to Supabase with column fallback
    if (isSupabaseConfigured && supabase) {
      try {
        const res = await supabase.from("loader_configs").upsert(record);
        if (res.error) {
          console.warn("Full upsert to Supabase loader_configs failed, falling back to base columns:", res.error.message);
          const baseRecord = {
            id: record.id,
            name: record.name,
            brand_name: record.brand_name,
            title: record.title,
            accent_color: record.accent_color,
            background_color: record.background_color,
            card_color: record.card_color,
            text_color: record.text_color,
            subtext_color: record.subtext_color,
            corner_radius: record.corner_radius,
            frame_width: record.frame_width,
            frame_height: record.frame_height,
            font_face: record.font_face,
            custom_subtitle: record.custom_subtitle,
            webhook_enabled: record.webhook_enabled,
            webhook_url: record.webhook_url,
            created_at: record.created_at,
            updated_at: record.updated_at,
          };
          await supabase.from("loader_configs").upsert(baseRecord);
        }
      } catch (err) {
        console.error("Supabase upsert error:", err);
      }
    }

    return record;
  },

  // Scripts
  async getScripts(): Promise<ScriptRecord[]> {
    const local = readLocalDb().scripts;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from("scripts").select("*").order("created_at", { ascending: false });
        if (data && !error && data.length > 0) {
          return data.map((remote) => {
            const loc = local.find((l) => l.id === remote.id || l.slug === remote.slug);
            return {
              ...loc,
              ...remote,
              modules: remote.modules || loc?.modules || {},
              use_auth: remote.use_auth ?? loc?.use_auth ?? true,
              loader_config_id: remote.loader_config_id || loc?.loader_config_id || null,
            };
          });
        }
      } catch (err) {
        console.error("Supabase getScripts error:", err);
      }
    }
    return local;
  },

  async getScriptBySlug(slug: string): Promise<ScriptRecord | null> {
    const local = readLocalDb().scripts.find((s) => s.slug === slug) || null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from("scripts").select("*").eq("slug", slug).maybeSingle();
        if (data && !error) {
          return {
            ...local,
            ...data,
            modules: data.modules || local?.modules || {},
            use_auth: data.use_auth ?? local?.use_auth ?? true,
            loader_config_id: data.loader_config_id || local?.loader_config_id || null,
          };
        }
      } catch (err) {
        console.error("Supabase getScriptBySlug error:", err);
      }
    }
    return local;
  },

  async saveScript(script: Omit<ScriptRecord, "id" | "created_at" | "updated_at"> & { id?: string }): Promise<ScriptRecord> {
    const id = script.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const cleanSlug = (script.slug || "").trim().toLowerCase();

    const db = readLocalDb();
    // Validate slug uniqueness against other scripts
    const slugConflict = db.scripts.find(
      (s) => s.slug.toLowerCase() === cleanSlug && s.id !== id
    );
    if (slugConflict) {
      throw new Error(`A script with the URL slug '${cleanSlug}' already exists ('${slugConflict.name}'). Please choose a unique slug.`);
    }

    const record: ScriptRecord = {
      ...script,
      slug: cleanSlug,
      id,
      created_at: now,
      updated_at: now,
    };

    // Always persist to local DB first for safety
    const index = db.scripts.findIndex((s) => s.id === id);
    if (index >= 0) db.scripts[index] = record;
    else db.scripts.unshift(record);
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const sanitizedLoaderConfigId =
        record.loader_config_id && UUID_REGEX.test(record.loader_config_id.trim())
          ? record.loader_config_id.trim()
          : null;

      const supabaseRecord: any = {
        id: record.id,
        name: record.name,
        slug: record.slug,
        entry_file: record.entry_file || "main.lua",
        modules: record.modules || {},
        loader_config_id: sanitizedLoaderConfigId,
        watermark_text: record.watermark_text || "AERO PROTECT",
        show_watermark: record.show_watermark !== false,
        is_active: record.is_active !== false,
        use_auth: record.use_auth !== false,
        is_maintenance: record.is_maintenance === true,
        maintenance_message: record.maintenance_message || null,
        created_at: record.created_at,
        updated_at: record.updated_at,
      };

      try {
        const { error } = await supabase.from("scripts").upsert(supabaseRecord);
        if (error) {
          console.warn("Supabase upsert script failed, trying fallback without loader_config_id:", error.message);
          // Retry without loader_config_id in case foreign key was missing
          const fallbackRecord = { ...supabaseRecord, loader_config_id: null };
          const resFallback = await supabase.from("scripts").upsert(fallbackRecord);
          if (resFallback.error) {
            console.error("Supabase fallback upsert script also failed:", resFallback.error.message);
          }
        }
      } catch (err) {
        console.error("Supabase saveScript exception:", err);
      }
    }

    return record;
  },

  async deleteScript(id: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("scripts").delete().eq("id", id);
      } catch (err) {
        console.error("Supabase deleteScript error:", err);
      }
    }
    const db = readLocalDb();
    db.scripts = db.scripts.filter((s) => s.id !== id);
    writeLocalDb(db);
  },

  // Keys
  async getKeys(): Promise<KeyRecord[]> {
    const local = readLocalDb().keys;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from("keys").select("*").order("created_at", { ascending: false });
        if (data && !error && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.error("Supabase getKeys error:", err);
      }
    }
    return local;
  },

  async createKeys(
    keys: Array<{
      key_string: string;
      script_id: string;
      duration_hours: number | null;
      status?: "unclaimed" | "claimed" | "active" | "banned";
      is_staff_review?: boolean;
      claimed_discord_tag?: string | null;
      claimed_discord_id?: string | null;
      notes?: string | null;
    }>
  ): Promise<KeyRecord[]> {
    const now = new Date().toISOString();
    const records: KeyRecord[] = keys.map((k) => ({
      id: crypto.randomUUID(),
      key_string: k.key_string,
      script_id: k.script_id || "all",
      status: k.status || (k.is_staff_review ? "active" : "unclaimed"),
      duration_hours: k.is_staff_review ? null : k.duration_hours,
      claimed_ip: null,
      claimed_discord_id: k.claimed_discord_id || (k.is_staff_review ? "STAFF_REVIEW" : null),
      claimed_discord_tag: k.claimed_discord_tag || (k.is_staff_review ? "STAFF_REVIEW" : null),
      claimed_at: k.is_staff_review ? now : null,
      activated_at: k.is_staff_review ? now : null,
      expires_at: null,
      created_at: now,
      is_staff_review: Boolean(k.is_staff_review),
      notes: k.notes || (k.is_staff_review ? "Staff Review Key" : null),
    }));

    const db = readLocalDb();
    db.keys.unshift(...records);
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from("keys").insert(records);
        if (error) {
          console.warn("Supabase insert keys failed, retrying without optional columns:", error.message);
          const fallbackRecords = records.map(({ activated_at, is_staff_review, notes, ...rest }) => rest);
          await supabase.from("keys").insert(fallbackRecords);
        }
      } catch (err) {
        console.error("Supabase createKeys error:", err);
      }
    }

    return records;
  },

  async getActiveKeyForIp(ip: string, scriptId?: string): Promise<KeyRecord | null> {
    const target = normalizeIp(ip);
    const now = new Date();

    const matchesActiveKey = (k: KeyRecord) => {
      if (isStaffReviewKey(k) || k.is_staff_review) return false;
      if (k.status !== "claimed" && k.status !== "active") return false;
      if (normalizeIp(k.claimed_ip) !== target) return false;

      // If scriptId is specified, check compatibility
      if (scriptId && scriptId !== "all") {
        if (k.script_id && k.script_id !== "all" && k.script_id !== scriptId) {
          return false;
        }
      }

      // Check if expired
      if (k.expires_at) {
        const expires = new Date(k.expires_at);
        if (now > expires) return false;
      }
      return true;
    };

    // 1. Check Supabase first if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("keys")
          .select("*")
          .in("status", ["claimed", "active"]);

        if (data && !error && data.length > 0) {
          const match = (data as KeyRecord[]).find(matchesActiveKey);
          if (match) return match;
        }
      } catch (err) {
        console.error("Supabase getActiveKeyForIp error:", err);
      }
    }

    // 2. Check local DB fallback
    const db = readLocalDb();
    const existing = db.keys.find(matchesActiveKey);
    return existing || null;
  },

  async claimKey(scriptId: string, ip: string, discord?: { id: string; tag: string }): Promise<KeyRecord | null> {
    const isEligibleKey = (k: KeyRecord) => {
      if (k.status !== "unclaimed") return false;
      if (isStaffReviewKey(k) || k.is_staff_review) return false;
      if (k.claimed_discord_tag === "STAFF_REVIEW" || k.claimed_discord_id === "STAFF_REVIEW") return false;
      // Lifetime keys (duration_hours === null) are exclusively for paid direct buyers and cannot be claimed via checkpoints
      if (k.duration_hours === null || k.duration_hours === undefined) return false;

      // Universal keys (script_id is "all", null, or empty) are eligible for ANY script
      if (!k.script_id || k.script_id === "all" || k.script_id === "") return true;

      // If claimant didn't ask for a specific script, any non-staff key is eligible
      if (!scriptId || scriptId === "all") return true;

      // Otherwise, the key's script_id must match the requested scriptId
      return k.script_id === scriptId;
    };

    let key: KeyRecord | null = null;

    // 1. Query Supabase first if configured (where production keys are stored)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("keys")
          .select("*")
          .eq("status", "unclaimed")
          .not("duration_hours", "is", null)
          .order("created_at", { ascending: true })
          .limit(200);

        if (data && !error && data.length > 0) {
          const typedData = data as KeyRecord[];
          // Prefer a script-specific key first if one exists, otherwise fallback to universal
          const specificMatch =
            scriptId && scriptId !== "all"
              ? typedData.find((k) => k.script_id === scriptId && isEligibleKey(k))
              : null;

          const match = specificMatch || typedData.find(isEligibleKey);
          if (match) {
            key = { ...match };
          }
        }
      } catch (err) {
        console.error("Supabase claimKey search error:", err);
      }
    }

    // 2. Fall back to local DB if not found in Supabase
    if (!key) {
      const db = readLocalDb();
      const specificMatch =
        scriptId && scriptId !== "all"
          ? db.keys.find((k) => k.script_id === scriptId && isEligibleKey(k))
          : null;

      const match = specificMatch || db.keys.find(isEligibleKey);
      if (match) {
        key = { ...match };
      }
    }

    if (!key) return null;

    // 3. Mark key as claimed and bind to claimant IP / Discord
    const now = new Date();
    key.status = "claimed";
    key.claimed_ip = ip;
    key.claimed_at = now.toISOString();

    // If key was universal and claimed for a specific script, bind it to that script
    if (scriptId && scriptId !== "all" && (!key.script_id || key.script_id === "all")) {
      key.script_id = scriptId;
    }
    if (discord) {
      key.claimed_discord_id = discord.id;
      key.claimed_discord_tag = discord.tag;
    }
    key.expires_at = null;
    key.activated_at = null;

    // 4. Update in local DB
    const db = readLocalDb();
    const localIdx = db.keys.findIndex((k) => k.id === key!.id);
    if (localIdx >= 0) {
      db.keys[localIdx] = { ...key };
    } else {
      db.keys.unshift({ ...key });
    }
    writeLocalDb(db);

    // 5. Update in Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from("keys")
          .update({
            status: key.status,
            claimed_ip: key.claimed_ip,
            claimed_at: key.claimed_at,
            script_id: key.script_id,
            claimed_discord_id: key.claimed_discord_id,
            claimed_discord_tag: key.claimed_discord_tag,
            expires_at: key.expires_at,
            activated_at: key.activated_at,
          })
          .eq("id", key.id);

        if (error) {
          console.warn("Supabase update key on claim failed, retrying base fields:", error.message);
          await supabase
            .from("keys")
            .update({
              status: key.status,
              claimed_ip: key.claimed_ip,
              claimed_at: key.claimed_at,
              script_id: key.script_id,
            })
            .eq("id", key.id);
        }
      } catch (err) {
        console.error("Supabase claimKey update error:", err);
      }
    }

    return key;
  },

  async activateKey(id: string, ip?: string): Promise<KeyRecord | null> {
    let key: KeyRecord | null = null;
    const db = readLocalDb();
    const local = db.keys.find((k) => k.id === id);
    if (local) {
      key = local;
    } else if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from("keys").select("*").eq("id", id).maybeSingle();
        if (data) key = data as KeyRecord;
      } catch (err) {
        console.error("Supabase activateKey find error:", err);
      }
    }

    if (!key) return null;

    const now = new Date();
    key.status = "active";
    if (ip && !key.claimed_ip) {
      key.claimed_ip = ip;
      key.claimed_at = now.toISOString();
    }
    if (isStaffReviewKey(key)) {
      key.duration_hours = null;
      key.expires_at = null;
    } else if (!key.activated_at) {
      key.activated_at = now.toISOString();
      if (key.duration_hours) {
        const expires = new Date(now.getTime() + key.duration_hours * 3600 * 1000);
        key.expires_at = expires.toISOString();
      }
    }

    const localIdx = db.keys.findIndex((k) => k.id === id);
    if (localIdx >= 0) {
      db.keys[localIdx] = { ...key };
    } else {
      db.keys.unshift({ ...key });
    }
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from("keys").update(key).eq("id", key.id);
        if (error) {
          const { activated_at, is_staff_review, notes, ...rest } = key;
          await supabase.from("keys").update(rest).eq("id", key.id);
        }
      } catch (err) {
        console.error("Supabase activateKey error:", err);
      }
    }
    return key;
  },

  async updateKeyNotes(id: string, notes: string | null) {
    const db = readLocalDb();
    const key = db.keys.find((k) => k.id === id);
    if (key) {
      key.notes = notes;
      writeLocalDb(db);
    }
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from("keys").update({ notes }).eq("id", id);
        if (error) {
          console.warn("Supabase updateKeyNotes error:", error.message);
        }
      } catch (err) {
        console.error("Supabase updateKeyNotes exception:", err);
      }
    }
  },

  async getKeyById(id: string): Promise<KeyRecord | null> {
    const db = readLocalDb();
    const local = db.keys.find((k) => k.id === id) || null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from("keys").select("*").eq("id", id).maybeSingle();
        if (data) return data;
      } catch (err) {
        console.error("Supabase getKeyById error:", err);
      }
    }
    return local;
  },

  async getKeyByString(keyString: string): Promise<KeyRecord | null> {
    const db = readLocalDb();
    const local = db.keys.find((k) => k.key_string === keyString) || null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from("keys").select("*").eq("key_string", keyString).maybeSingle();
        if (data) return data;
      } catch (err) {
        console.error("Supabase getKeyByString error:", err);
      }
    }
    return local;
  },

  async resetKeyIp(keyString: string, newIp: string): Promise<KeyRecord> {
    const cleanKey = keyString.trim();
    const key = await this.getKeyByString(cleanKey);
    if (!key) {
      throw new Error("License key not found.");
    }
    if (key.status === "banned") {
      throw new Error("This license key is banned and cannot be transferred.");
    }
    if (await this.isIpBanned(newIp)) {
      throw new Error("Cannot bind key to blacklisted IP address.");
    }

    // 12-hour cooldown check via note tag [IP_RESET:<timestamp>]
    const COOLDOWN_MS = 12 * 60 * 60 * 1000;
    const match = (key.notes || "").match(/\[IP_RESET:(\d+)\]/);
    if (match) {
      const lastReset = Number(match[1]);
      const elapsed = Date.now() - lastReset;
      if (elapsed < COOLDOWN_MS) {
        const remainingHours = Math.ceil((COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
        throw new Error(`IP reset is on cooldown. You can reset your key IP again in ${remainingHours} hour(s).`);
      }
    }

    const normNewIp = normalizeIp(newIp);
    key.claimed_ip = normNewIp;
    const cleanNotes = (key.notes || "").replace(/\[IP_RESET:\d+\]/g, "").trim();
    key.notes = cleanNotes ? `${cleanNotes} [IP_RESET:${Date.now()}]` : `[IP_RESET:${Date.now()}]`;

    const db = readLocalDb();
    const localIdx = db.keys.findIndex((k) => k.id === key.id);
    if (localIdx >= 0) db.keys[localIdx] = key;
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from("keys")
          .update({
            claimed_ip: key.claimed_ip,
            notes: key.notes,
          })
          .eq("id", key.id);
      } catch (err) {
        console.error("Supabase resetKeyIp error:", err);
      }
    }

    return key;
  },

  async updateKeyStatus(id: string, status: KeyRecord["status"]) {
    const db = readLocalDb();
    const key = db.keys.find((k) => k.id === id);
    if (key) {
      key.status = status;
      writeLocalDb(db);
    }
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("keys").update({ status }).eq("id", id);
      } catch (err) {
        console.error("Supabase updateKeyStatus error:", err);
      }
    }
  },

  async deleteKey(id: string) {
    const db = readLocalDb();
    db.keys = db.keys.filter((k) => k.id !== id);
    writeLocalDb(db);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("keys").delete().eq("id", id);
      } catch (err) {
        console.error("Supabase deleteKey error:", err);
      }
    }
  },

  // Sessions
  async getSessions(): Promise<SessionRecord[]> {
    const local = readLocalDb().sessions;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from("sessions").select("*").order("session_started", { ascending: false });
        if (data && !error && data.length > 0) return data;
      } catch (err) {
        console.error("Supabase getSessions error:", err);
      }
    }
    return local;
  },

  async createSession(session: Omit<SessionRecord, "id" | "created_at" | "session_started" | "last_heartbeat" | "pending_commands">): Promise<SessionRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const avatarUrl =
      session.avatar_url ||
      (session.roblox_user_id
        ? `https://www.roblox.com/headshot-thumbnail/image?userId=${session.roblox_user_id}&width=150&height=150&format=png`
        : null);

    const record: SessionRecord = {
      ...session,
      avatar_url: avatarUrl,
      id,
      pending_commands: [],
      session_started: now,
      last_heartbeat: now,
      created_at: now,
    };

    const db = readLocalDb();
    db.sessions.unshift(record);
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("sessions").insert([record]);
      } catch (err) {
        console.error("Supabase createSession error:", err);
      }
    }
    return record;
  },

  async updateHeartbeat(
    sessionId: string,
    ip?: string,
    metadata?: {
      place_id?: string | number;
      place_name?: string;
      job_id?: string;
      roblox_username?: string;
      roblox_user_id?: string;
    }
  ): Promise<SessionRecord> {
    const db = readLocalDb();
    let session = db.sessions.find((s) => s.id === sessionId);

    // 1. Query Supabase if not present in ephemeral local container memory
    if (!session && isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
        if (data && !error) {
          session = data;
          db.sessions.unshift(data);
          writeLocalDb(db);
        }
      } catch (err) {
        console.error("Supabase updateHeartbeat lookup error:", err);
      }
    }

    const now = new Date().toISOString();

    // 2. If session wasn't found anywhere (e.g. serverless cold start / fresh deployment),
    // NEVER terminate legitimate users due to ephemeral memory loss. Revive gracefully!
    if (!session) {
      session = {
        id: sessionId,
        key_id: "active",
        script_id: "active",
        ip_address: ip || "127.0.0.1",
        hwid: null,
        roblox_username: metadata?.roblox_username || "Player",
        roblox_user_id: metadata?.roblox_user_id || null,
        avatar_url: metadata?.roblox_user_id ? `/api/roblox/avatar?userId=${metadata.roblox_user_id}` : null,
        place_id: metadata?.place_id ? String(metadata.place_id) : null,
        place_name: metadata?.place_name || null,
        job_id: metadata?.job_id || null,
        status: "active",
        tamper_flags: [],
        pending_commands: [],
        session_started: now,
        last_heartbeat: now,
        created_at: now,
      };
      db.sessions.unshift(session);
      writeLocalDb(db);

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from("sessions").upsert([session]);
        } catch {
          // ignore
        }
      }
    } else {
      session.last_heartbeat = now;
      if (metadata?.place_id) session.place_id = String(metadata.place_id);
      if (metadata?.place_name) session.place_name = metadata.place_name;
      if (metadata?.job_id) session.job_id = metadata.job_id;
      if (metadata?.roblox_username && metadata.roblox_username !== "Player") {
        session.roblox_username = metadata.roblox_username;
      }
      if (metadata?.roblox_user_id) {
        session.roblox_user_id = metadata.roblox_user_id;
        session.avatar_url = `/api/roblox/avatar?userId=${metadata.roblox_user_id}`;
      }
      if (session.status === "disconnected") {
        session.status = "active"; // Player reconnected
      }
      writeLocalDb(db);

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from("sessions")
            .update({
              last_heartbeat: now,
              status: session.status,
              place_id: session.place_id,
              place_name: session.place_name,
              job_id: session.job_id,
              roblox_username: session.roblox_username,
              roblox_user_id: session.roblox_user_id,
              avatar_url: session.avatar_url,
            })
            .eq("id", sessionId);
        } catch {
          // ignore
        }
      }
    }

    return session;
  },

  async addSessionCommand(sessionId: string, command: Omit<SessionCommand, "id">) {
    const db = readLocalDb();
    const session = db.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.pending_commands.push({ id: crypto.randomUUID(), ...command });
      if (command.type === "kick") {
        session.status = "kicked";
      }
      writeLocalDb(db);

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from("sessions").update({
            status: session.status,
            pending_commands: session.pending_commands,
          }).eq("id", sessionId);
        } catch (err) {
          console.error("Supabase addSessionCommand error:", err);
        }
      }
    }
  },

  async broadcastAnnouncement(announcement: Omit<GlobalAnnouncement, "id" | "created_at">): Promise<GlobalAnnouncement> {
    const record: GlobalAnnouncement = {
      ...announcement,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    const db = readLocalDb();
    if (!db.global_announcements) db.global_announcements = [];
    db.global_announcements.unshift(record);
    if (db.global_announcements.length > 50) {
      db.global_announcements = db.global_announcements.slice(0, 50);
    }

    // Push announcement command to currently active sessions
    const now = Date.now();
    for (const s of db.sessions) {
      const ping = new Date(s.last_heartbeat).getTime();
      if (s.status === "active" && now - ping < 15000) {
        if (!announcement.script_id || announcement.script_id === "all" || s.script_id === announcement.script_id) {
          s.pending_commands.push({
            id: crypto.randomUUID(),
            type: "announcement",
            title: announcement.title,
            message: announcement.message,
            duration_seconds: announcement.duration_seconds || 10,
          });
        }
      }
    }
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("global_announcements").insert([record]);
      } catch (err) {
        console.error("Supabase broadcastAnnouncement error:", err);
      }
    }

    return record;
  },

  async getGlobalAnnouncements(scriptId?: string): Promise<GlobalAnnouncement[]> {
    let list: GlobalAnnouncement[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from("global_announcements").select("*").order("created_at", { ascending: false });
        if (scriptId && scriptId !== "all") {
          query = query.or(`script_id.eq.all,script_id.eq.${scriptId}`);
        }
        const { data, error } = await query.limit(50);
        if (data && !error) {
          list = data;
        }
      } catch (err) {
        console.error("Supabase getGlobalAnnouncements error:", err);
      }
    }

    const db = readLocalDb();
    const map = new Map<string, GlobalAnnouncement>();
    for (const a of list) map.set(a.id, a);
    for (const a of db.global_announcements || []) {
      if (!map.has(a.id)) {
        if (!scriptId || scriptId === "all" || a.script_id === "all" || a.script_id === scriptId) {
          map.set(a.id, a);
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async deleteGlobalAnnouncement(id: string): Promise<boolean> {
    const db = readLocalDb();
    if (!db.global_announcements) db.global_announcements = [];
    const lenBefore = db.global_announcements.length;
    db.global_announcements = db.global_announcements.filter((a) => a.id !== id);
    if (db.global_announcements.length !== lenBefore) {
      writeLocalDb(db);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("global_announcements").delete().eq("id", id);
      } catch (err) {
        console.error("Supabase deleteGlobalAnnouncement error:", err);
      }
    }
    return true;
  },

  async broadcastCommand(command: Omit<SessionCommand, "id">, scriptId?: string): Promise<number> {
    const db = readLocalDb();
    const now = Date.now();
    let count = 0;
    for (const s of db.sessions) {
      const ping = new Date(s.last_heartbeat).getTime();
      if (s.status === "active" && now - ping < 15000) {
        if (!scriptId || scriptId === "all" || s.script_id === scriptId) {
          s.pending_commands.push({ id: crypto.randomUUID(), ...command });
          if (command.type === "kick") {
            s.status = "kicked";
          }
          count++;
        }
      }
    }
    if (count > 0) {
      writeLocalDb(db);
    }
    return count;
  },

  async clearPendingCommands(sessionId: string): Promise<SessionCommand[]> {
    const db = readLocalDb();
    const session = db.sessions.find((s) => s.id === sessionId);
    if (!session) return [];
    const cmds = [...session.pending_commands];
    session.pending_commands = [];
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("sessions").update({ pending_commands: [] }).eq("id", sessionId);
      } catch (err) {
        console.error("Supabase clearPendingCommands error:", err);
      }
    }
    return cmds;
  },

  async deleteSession(sessionId: string): Promise<boolean> {
    const db = readLocalDb();
    db.sessions = db.sessions.filter((s) => s.id !== sessionId);
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("sessions").delete().eq("id", sessionId);
      } catch (err) {
        console.error("Supabase deleteSession error:", err);
      }
    }
    return true;
  },

  // Staff Reviews
  async createStaffReview(review: {
    key_id: string;
    script_id: string;
    script_name: string;
    key_label: string;
  }): Promise<StaffReviewRecord> {
    const now = new Date().toISOString();
    const record: StaffReviewRecord = {
      id: "staff_review_" + crypto.randomUUID(),
      key_id: review.key_id,
      script_id: review.script_id,
      script_name: review.script_name,
      key_label: review.key_label,
      status: "reviewing",
      review_started: now,
      last_heartbeat: now,
      duration_seconds: 0,
      created_at: now,
    };

    const db = readLocalDb();
    if (!db.staff_reviews) db.staff_reviews = [];
    db.staff_reviews.unshift(record);
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("staff_reviews").insert(record);
      } catch {
        // Fallback gracefully if table not yet migrated
      }
    }

    return record;
  },

  async updateStaffReviewHeartbeat(sessionToken: string): Promise<StaffReviewRecord | null> {
    const db = readLocalDb();
    if (!db.staff_reviews) db.staff_reviews = [];
    const review = db.staff_reviews.find((r) => r.id === sessionToken);
    if (!review) return null;

    const now = new Date();
    const startTime = new Date(review.review_started).getTime();
    review.last_heartbeat = now.toISOString();
    review.status = "reviewing";
    review.duration_seconds = Math.max(0, Math.floor((now.getTime() - startTime) / 1000));

    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from("staff_reviews")
          .update({
            last_heartbeat: review.last_heartbeat,
            duration_seconds: review.duration_seconds,
            status: "reviewing",
          })
          .eq("id", review.id);
      } catch {
        // ignore
      }
    }

    return review;
  },

  async getStaffReviews(): Promise<StaffReviewRecord[]> {
    const db = readLocalDb();
    if (!db.staff_reviews) db.staff_reviews = [];
    const now = Date.now();
    const TIMEOUT_MS = 6000; // 6s without heartbeat -> marked completed review

    let modified = false;
    for (const r of db.staff_reviews) {
      const pingTime = new Date(r.last_heartbeat).getTime();
      const startTime = new Date(r.review_started).getTime();
      const elapsed = now - pingTime;

      if (r.status === "reviewing" && elapsed > TIMEOUT_MS) {
        r.status = "completed";
        r.duration_seconds = Math.max(0, Math.floor((pingTime - startTime) / 1000));
        modified = true;
      }
    }

    if (modified) {
      writeLocalDb(db);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("staff_reviews")
          .select("*")
          .order("review_started", { ascending: false });
        if (data && !error && data.length > 0) {
          const merged = [...db.staff_reviews];
          for (const item of data) {
            if (!merged.some((m) => m.id === item.id)) {
              merged.push(item);
            }
          }
          return merged.sort(
            (a, b) => new Date(b.review_started).getTime() - new Date(a.review_started).getTime()
          );
        }
      } catch {
        // fallback
      }
    }

    return db.staff_reviews.sort(
      (a, b) => new Date(b.review_started).getTime() - new Date(a.review_started).getTime()
    );
  },

  // IP Bans
  async isIpBanned(ip: string): Promise<boolean> {
    const cleanIp = normalizeIp(ip);
    if (!cleanIp || cleanIp === "127.0.0.1") return false;
    const db = readLocalDb();
    if (Boolean(db.banned_ips[cleanIp]) || Boolean(db.banned_ips[ip])) return true;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from("banned_ips").select("ip_address").eq("ip_address", cleanIp).maybeSingle();
        if (data) return true;
      } catch (err) {
        console.error("Supabase isIpBanned error:", err);
      }
    }
    return false;
  },

  async banIp(ip: string, reason: string) {
    const cleanIp = normalizeIp(ip);
    if (!cleanIp || cleanIp === "127.0.0.1") return;
    const db = readLocalDb();
    const banned_at = new Date().toISOString();
    db.banned_ips[cleanIp] = { reason, banned_at };

    // Cascading IP Ban: automatically set status = "banned" on all keys claimed by or bound to this IP
    db.keys.forEach((k) => {
      if (k.claimed_ip && normalizeIp(k.claimed_ip) === cleanIp) {
        k.status = "banned";
      }
    });

    db.sessions.forEach((s) => {
      if (s.ip_address && normalizeIp(s.ip_address) === cleanIp) {
        s.status = "kicked";
        s.pending_commands.push({ id: crypto.randomUUID(), type: "kick", reason: "IP address has been banned." });
      }
    });
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("banned_ips").upsert({ ip_address: cleanIp, reason, banned_at });
        await supabase.from("keys").update({ status: "banned" }).eq("claimed_ip", cleanIp);
      } catch (err) {
        console.error("Supabase banIp error:", err);
      }
    }
  },

  /**
   * Automates critical tamper / abuse bans:
   * 1. Bans the requester's current IP address.
   * 2. If the request was verified to be from the key's bound owner (or verified session),
   *    revokes the license key and bans the bound IP.
   *    PREVENTS THIRD-PARTY GRIEFING: Never bans an innocent third-party claimed_ip from an unauthenticated probe.
   */
  async autoBanOffender(
    currentIp: string,
    keyRecordOrIdOrString?: KeyRecord | string | null,
    reason: string = "Security Integrity Violation",
    options: { banLinkedClaimedIp?: boolean } = {}
  ): Promise<{ bannedIps: string[]; keyBanned: boolean }> {
    const bannedIps: string[] = [];
    let keyBanned = false;

    // 1. Ban current client IP
    const normCurrent = normalizeIp(currentIp);
    if (normCurrent && normCurrent !== "127.0.0.1") {
      await this.banIp(normCurrent, reason);
      bannedIps.push(normCurrent);
    }

    // 2. Resolve key record if provided
    let key: KeyRecord | null = null;
    if (typeof keyRecordOrIdOrString === "string") {
      key = await this.getKeyById(keyRecordOrIdOrString);
      if (!key) {
        key = await this.getKeyByString(keyRecordOrIdOrString);
      }
    } else if (keyRecordOrIdOrString && typeof keyRecordOrIdOrString === "object") {
      key = keyRecordOrIdOrString;
    }

    // Never ban staff review keys or their IPs
    if (key && isStaffReviewKey(key)) {
      return { bannedIps, keyBanned: false };
    }

    // 3. Only revoke key and ban claimed_ip if the requester is the key owner
    // OR if explicitly requested from an authenticated session (banLinkedClaimedIp)
    if (key) {
      const claimed = key.claimed_ip ? normalizeIp(key.claimed_ip) : null;
      const isOwner = Boolean(claimed && claimed === normCurrent);
      const shouldBanLinked = isOwner || options.banLinkedClaimedIp === true;

      if (shouldBanLinked) {
        if (claimed && claimed !== "127.0.0.1" && claimed !== normCurrent) {
          await this.banIp(
            claimed,
            `Linked Key Tampering: Original IP bound during key claim (${key.key_string}) — Reason: ${reason}`
          );
          bannedIps.push(claimed);
        }

        if (key.status !== "banned") {
          await this.updateKeyStatus(key.id, "banned");
          keyBanned = true;
        }
      }
    }

    return { bannedIps, keyBanned };
  },

  async unbanIp(ip: string) {
    const cleanIp = normalizeIp(ip);
    const db = readLocalDb();
    delete db.banned_ips[cleanIp];
    delete db.banned_ips[ip];
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("banned_ips").delete().eq("ip_address", ip);
      } catch (err) {
        console.error("Supabase unbanIp error:", err);
      }
    }
  },

  async getBannedIps(): Promise<Record<string, { reason: string; banned_at: string }>> {
    const local = readLocalDb().banned_ips;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from("banned_ips").select("*");
        if (data && !error) {
          const map: Record<string, { reason: string; banned_at: string }> = { ...local };
          data.forEach((row) => {
            map[row.ip_address] = { reason: row.reason, banned_at: row.banned_at };
          });
          return map;
        }
      } catch (err) {
        console.error("Supabase getBannedIps error:", err);
      }
    }
    return local;
  },

  // Settings
  async getSettings(): Promise<SystemSettings> {
    const local = readLocalDb().settings;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from("system_settings").select("*").eq("id", 1).maybeSingle();
        if (data && !error) {
          return {
            ...local,
            ...data,
          };
        }
      } catch (err) {
        console.error("Supabase getSettings error:", err);
      }
    }
    return local;
  },

  async saveSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const db = readLocalDb();
    db.settings = { ...db.settings, ...settings };
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("system_settings").upsert({
          id: 1,
          ...db.settings,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Supabase saveSettings error:", err);
      }
    }
    return db.settings;
  },

  // Execution & Analytics Logging
  async recordExecution(log: Omit<ExecutionLog, "id" | "created_at">): Promise<ExecutionLog> {
    const id = crypto.randomUUID();
    const avatarUrl =
      log.avatar_url ||
      (log.roblox_user_id
        ? `https://www.roblox.com/headshot-thumbnail/image?userId=${log.roblox_user_id}&width=150&height=150&format=png`
        : null);

    const record: ExecutionLog = {
      ...log,
      avatar_url: avatarUrl,
      id,
      created_at: new Date().toISOString(),
    };

    const db = readLocalDb();
    db.execution_logs.unshift(record);
    if (db.execution_logs.length > 5000) {
      db.execution_logs = db.execution_logs.slice(0, 5000);
    }
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("execution_logs").insert([record]);
      } catch (err) {
        console.error("Supabase recordExecution error:", err);
      }
    }
    return record;
  },

  async recordCheckpoint(stage: "started" | "completed", ip: string, scriptId?: string): Promise<void> {
    const record: CheckpointLog = {
      id: crypto.randomUUID(),
      script_id: scriptId,
      ip_address: ip,
      stage,
      created_at: new Date().toISOString(),
    };

    const db = readLocalDb();
    db.checkpoint_logs.unshift(record);
    if (db.checkpoint_logs.length > 5000) {
      db.checkpoint_logs = db.checkpoint_logs.slice(0, 5000);
    }
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("checkpoint_logs").insert([record]);
      } catch (err) {
        console.error("Supabase recordCheckpoint error:", err);
      }
    }
  },

  async getAnalytics(timeframe = "all", scriptId?: string) {
    const cutoff = getTimeCutoff(timeframe);
    let executions: ExecutionLog[] = [];
    let checkpoints: CheckpointLog[] = [];

    // 1. Fetch remote logs from Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        let execQuery = supabase
          .from("execution_logs")
          .select("*")
          .order("created_at", { ascending: false });

        if (cutoff) {
          execQuery = execQuery.gte("created_at", new Date(cutoff).toISOString());
        }

        const { data: remoteLogs, error: execErr } = await execQuery.limit(2500);
        if (remoteLogs && !execErr) {
          executions = remoteLogs;
        }

        let cpQuery = supabase
          .from("checkpoint_logs")
          .select("*")
          .order("created_at", { ascending: false });

        if (cutoff) {
          cpQuery = cpQuery.gte("created_at", new Date(cutoff).toISOString());
        }

        const { data: remoteCp, error: cpErr } = await cpQuery.limit(2500);
        if (remoteCp && !cpErr) {
          checkpoints = remoteCp;
        }
      } catch (err) {
        console.error("Supabase getAnalytics error:", err);
      }
    }

    // 2. Fallback and merge with local database (de-duplicated by id)
    const db = readLocalDb();
    const execMap = new Map<string, ExecutionLog>();
    for (const log of executions) execMap.set(log.id, log);
    for (const log of db.execution_logs || []) {
      if (!execMap.has(log.id)) {
        if (cutoff && new Date(log.created_at).getTime() < cutoff) continue;
        execMap.set(log.id, log);
      }
    }
    let allExecs = Array.from(execMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Filter by specific script if requested
    if (scriptId && scriptId !== "all") {
      allExecs = allExecs.filter(
        (e) =>
          e.script_id === scriptId ||
          e.script_name?.toLowerCase() === scriptId.toLowerCase()
      );
    }

    const cpMap = new Map<string, CheckpointLog>();
    for (const cp of checkpoints) cpMap.set(cp.id, cp);
    for (const cp of db.checkpoint_logs || []) {
      if (!cpMap.has(cp.id)) {
        if (cutoff && new Date(cp.created_at).getTime() < cutoff) continue;
        cpMap.set(cp.id, cp);
      }
    }
    let allCps = Array.from(cpMap.values());
    if (scriptId && scriptId !== "all") {
      allCps = allCps.filter((c) => !c.script_id || c.script_id === scriptId);
    }

    // 3. Compute KPI Metrics
    const totalExecutions = allExecs.length;
    const passedExecutions = allExecs.filter((e) => e.status === "success").length;
    const failedExecutions = allExecs.filter((e) => e.status === "failed").length;
    const passRate = totalExecutions > 0 ? Math.round((passedExecutions / totalExecutions) * 100) : 100;

    const uniqueUsers = new Set(
      allExecs.map((e) => e.roblox_user_id || e.roblox_username || e.ip_address).filter(Boolean)
    ).size;
    const uniqueIps = new Set(allExecs.map((e) => e.ip_address).filter(Boolean)).size;

    // Checkpoint metrics
    const checkpointsStarted = allCps.filter((c) => c.stage === "started").length;
    const checkpointsCompleted = allCps.filter((c) => c.stage === "completed").length;
    const checkpointConversionRate =
      checkpointsStarted > 0 ? Math.round((checkpointsCompleted / checkpointsStarted) * 100) : 100;

    // Failure reason breakdown
    const failureReasons: Record<string, number> = {};
    allExecs
      .filter((e) => e.status === "failed" && e.failure_reason)
      .forEach((e) => {
        const reason = e.failure_reason || "Unknown";
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });

    // Top executors
    const executors: Record<string, number> = {};
    allExecs.forEach((e) => {
      const exec = e.executor || "Unknown Executor";
      executors[exec] = (executors[exec] || 0) + 1;
    });

    // Top OS
    const operatingSystems: Record<string, number> = {};
    allExecs.forEach((e) => {
      const os = e.os || "Desktop (Windows)";
      operatingSystems[os] = (operatingSystems[os] || 0) + 1;
    });

    // Scripts breakdown
    const scriptsBreakdown: Record<string, { total: number; passed: number; failed: number }> = {};
    allExecs.forEach((e) => {
      const sName = e.script_name || "Unknown Script";
      if (!scriptsBreakdown[sName]) {
        scriptsBreakdown[sName] = { total: 0, passed: 0, failed: 0 };
      }
      scriptsBreakdown[sName].total += 1;
      if (e.status === "success") scriptsBreakdown[sName].passed += 1;
      else scriptsBreakdown[sName].failed += 1;
    });

    // Activity timeline (grouped by hour if past day, or by date otherwise)
    const isDay = timeframe === "day";
    const timelineMap: Record<string, { label: string; passed: number; failed: number; total: number }> = {};

    allExecs.forEach((e) => {
      const d = new Date(e.created_at);
      let key = "";
      let label = "";

      if (isDay) {
        const hour = d.getHours();
        key = `${hour.toString().padStart(2, "0")}:00`;
        label = key;
      } else {
        key = d.toISOString().split("T")[0];
        label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }

      if (!timelineMap[key]) {
        timelineMap[key] = { label, passed: 0, failed: 0, total: 0 };
      }
      timelineMap[key].total += 1;
      if (e.status === "success") timelineMap[key].passed += 1;
      else timelineMap[key].failed += 1;
    });

    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ key, ...val }));

    // Top Games / Place IDs
    const gamesMap: Record<string, { place_id: string; place_name: string; count: number }> = {};
    allExecs.forEach((e) => {
      const pId = e.place_id ? String(e.place_id).trim() : null;
      if (pId) {
        const pName = e.place_name || `Place #${pId}`;
        if (!gamesMap[pId]) {
          gamesMap[pId] = { place_id: pId, place_name: pName, count: 0 };
        }
        gamesMap[pId].count += 1;
      }
    });
    const topGames = Object.values(gamesMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((g) => ({
        ...g,
        percentage: totalExecutions > 0 ? Math.round((g.count / totalExecutions) * 100) : 100,
      }));

    // Top Executors with percentage
    const topExecutors = Object.entries(executors)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalExecutions > 0 ? Math.round((count / totalExecutions) * 100) : 100,
      }));

    // Average session duration
    const relevantSessions = db.sessions.filter(
      (s) => !cutoff || new Date(s.session_started).getTime() >= cutoff
    );
    let totalDurationSec = 0;
    relevantSessions.forEach((s) => {
      const start = new Date(s.session_started).getTime();
      const end = new Date(s.last_heartbeat).getTime();
      totalDurationSec += Math.max(0, Math.floor((end - start) / 1000));
    });
    const avgSessionDurationSec =
      relevantSessions.length > 0 ? Math.round(totalDurationSec / relevantSessions.length) : 0;

    return {
      timeframe,
      totalExecutions,
      passedExecutions,
      failedExecutions,
      passRate,
      uniqueUsers,
      uniqueIps,
      checkpointsStarted,
      checkpointsCompleted,
      checkpointConversionRate,
      failureReasons,
      executors,
      topExecutors,
      topGames,
      avgSessionDurationSec,
      operatingSystems,
      scriptsBreakdown,
      timeline,
      recentLogs: allExecs.slice(0, 200),
    };
  },

  async clearAnalytics(): Promise<boolean> {
    const db = readLocalDb();
    db.execution_logs = [];
    db.checkpoint_logs = [];
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("execution_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("checkpoint_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (err) {
        console.error("Supabase clearAnalytics error:", err);
      }
    }
    return true;
  },

  // Checkpoints Management
  async getCheckpoints(scriptId?: string): Promise<CheckpointItem[]> {
    const all = await this.getAllCheckpoints();
    return all.filter((cp) => {
      if (!scriptId || scriptId === "all") return true;
      return cp.script_id === scriptId || cp.script_id === "all" || !cp.script_id;
    });
  },

  async getAllCheckpoints(): Promise<CheckpointItem[]> {
    const local = (readLocalDb().checkpoints || []).sort((a, b) => a.order - b.order);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from("checkpoints").select("*").order("order", { ascending: true });
        if (data && !error && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.error("Supabase getAllCheckpoints error:", err);
      }
    }
    return local;
  },

  async saveCheckpoint(
    checkpoint: Omit<CheckpointItem, "id" | "created_at"> & { id?: string }
  ): Promise<CheckpointItem> {
    const db = readLocalDb();
    if (!db.checkpoints) db.checkpoints = [];

    const id = checkpoint.id || crypto.randomUUID();
    const existingIndex = db.checkpoints.findIndex((cp) => cp.id === id);

    const record: CheckpointItem = {
      ...checkpoint,
      id,
      created_at: existingIndex >= 0 ? db.checkpoints[existingIndex].created_at : new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      db.checkpoints[existingIndex] = record;
    } else {
      db.checkpoints.push(record);
    }
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("checkpoints").upsert(record);
      } catch (err) {
        console.error("Supabase saveCheckpoint error:", err);
      }
    }

    return record;
  },

  async deleteCheckpoint(id: string): Promise<boolean> {
    const db = readLocalDb();
    if (!db.checkpoints) return false;
    const initialLen = db.checkpoints.length;
    db.checkpoints = db.checkpoints.filter((cp) => cp.id !== id);
    if (db.checkpoints.length !== initialLen) {
      writeLocalDb(db);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("checkpoints").delete().eq("id", id);
      } catch (err) {
        console.error("Supabase deleteCheckpoint error:", err);
      }
    }
    return true;
  },

  // Creator Profile (Guns.lol style)
  async getCreatorProfile(): Promise<CreatorProfile> {
    const local = readLocalDb().creator_profile || defaultCreatorProfile;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from("creator_profile").select("*").eq("id", 1).maybeSingle();
        if (data && !error) {
          return {
            ...local,
            display_name: data.display_name || local.display_name,
            bio: data.bio || local.bio,
            avatar_url: data.avatar_url || local.avatar_url,
            emblems: data.emblems || local.emblems,
            socials: data.socials || local.socials,
          };
        }
      } catch (err) {
        console.error("Supabase getCreatorProfile error:", err);
      }
    }
    return local;
  },

  async saveCreatorProfile(profile: Partial<CreatorProfile>): Promise<CreatorProfile> {
    const db = readLocalDb();
    db.creator_profile = {
      ...(db.creator_profile || defaultCreatorProfile),
      ...profile,
      socials: {
        ...(db.creator_profile?.socials || defaultCreatorProfile.socials),
        ...(profile.socials || {}),
      },
      emblems: profile.emblems || db.creator_profile?.emblems || defaultCreatorProfile.emblems,
    };
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("creator_profile").upsert({
          id: 1,
          display_name: db.creator_profile.display_name,
          bio: db.creator_profile.bio,
          avatar_url: db.creator_profile.avatar_url,
          emblems: db.creator_profile.emblems,
          socials: db.creator_profile.socials,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Supabase saveCreatorProfile error:", err);
      }
    }

    return db.creator_profile;
  },

  // Client Errors & Debug Telemetry
  async recordClientError(errorLog: Omit<ClientErrorLog, "id" | "created_at">): Promise<ClientErrorLog> {
    const id = crypto.randomUUID();
    const record: ClientErrorLog = {
      ...errorLog,
      id,
      created_at: new Date().toISOString(),
    };

    const db = readLocalDb();
    if (!db.client_errors) db.client_errors = [];
    db.client_errors.unshift(record);
    if (db.client_errors.length > 500) {
      db.client_errors = db.client_errors.slice(0, 500);
    }
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("client_errors").insert([record]);
      } catch {
        // graceful fallback if table not yet created
      }
    }
    return record;
  },

  async getClientErrors(limit = 100): Promise<ClientErrorLog[]> {
    let remote: ClientErrorLog[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("client_errors")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (data && !error) remote = data;
      } catch {
        // fallback
      }
    }

    const db = readLocalDb();
    const map = new Map<string, ClientErrorLog>();
    for (const e of remote) map.set(e.id, e);
    for (const e of db.client_errors || []) {
      if (!map.has(e.id)) map.set(e.id, e);
    }

    return Array.from(map.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  },

  async clearClientErrors(): Promise<boolean> {
    const db = readLocalDb();
    db.client_errors = [];
    writeLocalDb(db);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("client_errors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch {
        // ignore
      }
    }
    return true;
  },
};
