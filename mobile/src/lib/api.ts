// mobile/src/lib/api.ts
import { Preferences } from "@capacitor/preferences";

const TOKEN_KEY = "atom_admin_token";
const SERVER_URL_KEY = "atom_server_url";
const USERNAME_KEY = "atom_admin_username";

// Default server: use the current window origin in browser, or default to the public deployment or localhost
export const DEFAULT_SERVER_URL = "http://10.0.2.2:3000"; // 10.0.2.2 is Android emulator's loopback to host PC

export class ApiService {
  private static token: string | null = null;
  private static serverUrl: string = DEFAULT_SERVER_URL;

  public static async init() {
    try {
      const { value: storedToken } = await Preferences.get({ key: TOKEN_KEY });
      if (storedToken) this.token = storedToken;

      const { value: storedUrl } = await Preferences.get({ key: SERVER_URL_KEY });
      if (storedUrl) {
        this.serverUrl = storedUrl.replace(/\/+$/, "");
      } else if (typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost:3001")) {
        this.serverUrl = window.location.origin;
      }
    } catch {
      // Fallback to localStorage if Capacitor Preferences fails
      if (typeof window !== "undefined") {
        this.token = localStorage.getItem(TOKEN_KEY);
        const url = localStorage.getItem(SERVER_URL_KEY);
        if (url) this.serverUrl = url.replace(/\/+$/, "");
      }
    }
  }

  public static getServerUrl(): string {
    return this.serverUrl;
  }

  public static async setServerUrl(url: string) {
    const cleanUrl = url.trim().replace(/\/+$/, "");
    this.serverUrl = cleanUrl;
    await Preferences.set({ key: SERVER_URL_KEY, value: cleanUrl });
    if (typeof window !== "undefined") {
      localStorage.setItem(SERVER_URL_KEY, cleanUrl);
    }
  }

  public static getToken(): string | null {
    return this.token;
  }

  public static async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await Preferences.set({ key: TOKEN_KEY, value: token });
      if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
    } else {
      await Preferences.remove({ key: TOKEN_KEY });
      if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
    }
  }

  public static async isAuthenticated(): Promise<boolean> {
    if (!this.token) {
      await this.init();
    }
    return Boolean(this.token);
  }

  public static async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.serverUrl}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 401) {
        if (cleanEndpoint !== "/api/auth/login") {
          await this.setToken(null);
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || (cleanEndpoint === "/api/auth/login" ? "Invalid admin credentials" : "Session expired. Please log in again."));
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      return data;
    } catch (err: any) {
      clearTimeout(timeout);
      console.error(`API Error [${endpoint}]:`, err);
      if (err.name === "AbortError") {
        throw new Error("Request timed out (12s). The server did not respond. Check your server URL.");
      }
      throw err;
    }
  }

  // Auth
  public static async login(username: string, pass: string): Promise<boolean> {
    const res = await this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password: pass }),
    });

    if (res.success && res.token) {
      await this.setToken(res.token);
      await Preferences.set({ key: USERNAME_KEY, value: username });
      return true;
    }
    if (res.success && !res.token) {
      throw new Error("Server returned login success but is missing mobile token. Please deploy the updated backend code to your server.");
    }
    return false;
  }

  public static async logout() {
    try {
      await this.request("/api/auth/logout", { method: "POST" });
    } catch {}
    await this.setToken(null);
  }

  // Players & In-Game Command Center
  public static async getPlayers() {
    return this.request("/api/players");
  }

  public static async sendPlayerAction(payload: {
    action: "kick" | "message" | "execute_code" | "teleport" | "ban_ip" | "broadcast" | "delete_announcement";
    session_id?: string;
    ip_address?: string;
    reason?: string;
    message?: string;
    code?: string;
    place_id?: string | number;
    server_hop?: boolean;
    script_id?: string;
    title?: string;
    duration_seconds?: number;
    id?: string;
  }) {
    return this.request("/api/players", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Scripts Vault
  public static async getScripts() {
    return this.request("/api/scripts");
  }

  public static async updateScript(script: any) {
    return this.request("/api/scripts", {
      method: "PATCH",
      body: JSON.stringify(script),
    });
  }

  public static async createScript(script: any) {
    return this.request("/api/scripts", {
      method: "POST",
      body: JSON.stringify(script),
    });
  }

  public static async deleteScript(id: string) {
    return this.request(`/api/scripts?id=${id}`, {
      method: "DELETE",
    });
  }

  public static async syncGithub(scriptId: string) {
    return this.request("/api/scripts/github/sync", {
      method: "POST",
      body: JSON.stringify({ script_id: scriptId }),
    });
  }

  // Keys Pool
  public static async getKeys() {
    return this.request("/api/keys");
  }

  public static async createKeys(options: {
    count?: number;
    prefix?: string;
    script_id?: string;
    duration_hours?: number | null;
    is_staff_review?: boolean;
    custom_key?: string;
    notes?: string;
  }) {
    return this.request("/api/keys", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  public static async updateKey(id: string, status?: string, notes?: string) {
    return this.request("/api/keys", {
      method: "PATCH",
      body: JSON.stringify({ id, status, notes }),
    });
  }

  public static async deleteKey(id: string) {
    return this.request(`/api/keys?id=${id}`, {
      method: "DELETE",
    });
  }

  // Checkpoints & Bypass Locks
  public static async getCheckpoints() {
    return this.request("/api/checkpoints");
  }

  public static async saveCheckpoints(checkpoints: any[]) {
    return this.request("/api/checkpoints", {
      method: "POST",
      body: JSON.stringify({ checkpoints }),
    });
  }

  public static async getBypassAttempts() {
    return this.request("/api/checkpoints/bypass-attempts");
  }

  public static async releaseBypassLock(payload: { ip?: string; hwid?: string }) {
    return this.request("/api/checkpoints/bypass-attempts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Loader Configs
  public static async getLoaderConfigs() {
    return this.request("/api/loader-configs");
  }

  public static async saveLoaderConfig(config: any) {
    return this.request("/api/loader-configs", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  // Chatroom & DMs
  public static async getChatMessages(limit = 50) {
    return this.request(`/api/chatroom/messages?limit=${limit}`);
  }

  public static async postChatMessage(message: string, isDev = true) {
    return this.request("/api/chatroom/messages", {
      method: "POST",
      body: JSON.stringify({
        userId: "admin",
        username: "AtomProtect Admin",
        displayName: "Admin",
        message,
        isDev,
      }),
    });
  }

  public static async deleteChatMessage(messageId: string) {
    return this.request(`/api/chatroom/messages?id=${messageId}`, {
      method: "DELETE",
    });
  }

  public static async getDms() {
    return this.request("/api/chatroom/dms");
  }

  public static async sendDm(userId: string, message: string) {
    return this.request("/api/chatroom/dms", {
      method: "POST",
      body: JSON.stringify({
        userId,
        message,
        senderType: "dev",
      }),
    });
  }

  // Analytics & Errors
  public static async getAnalytics() {
    return this.request("/api/analytics");
  }

  public static async getClientErrors(limit = 100) {
    return this.request(`/api/telemetry/errors?limit=${limit}`);
  }

  // Settings & IP Bans
  public static async getSettings() {
    return this.request("/api/settings");
  }

  public static async updateSettings(settings: any) {
    return this.request("/api/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    });
  }

  public static async getBannedIps() {
    return this.request("/api/ip-bans");
  }

  public static async banIp(ip_address: string, reason: string) {
    return this.request("/api/ip-bans", {
      method: "POST",
      body: JSON.stringify({ ip_address, reason }),
    });
  }

  public static async unbanIp(ip_address: string) {
    return this.request(`/api/ip-bans?ip=${encodeURIComponent(ip_address)}`, {
      method: "DELETE",
    });
  }
}
