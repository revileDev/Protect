// lib/discord-webhook.ts

export interface WebhookExecutionPayload {
  webhookUrl: string;
  scriptName: string;
  robloxUsername: string;
  robloxUserId: string;
  ipAddress: string;
  isp: string;
  os: string;
  executor: string;
  keyLast4: string;
  success: boolean;
  failureReason?: string;
}

export async function sendExecutionWebhook(data: WebhookExecutionPayload) {
  const url = data.webhookUrl?.trim();
  if (!url || !url.startsWith("http")) return;

  const color = data.success ? 0x22c55e : 0xef4444; // Green or Red
  const statusTitle = data.success
    ? "Auth Successful - Script Executed"
    : "Auth Failed - Execution Blocked";

  const fields = [
    {
      name: "Roblox User",
      value: `\`${data.robloxUsername || "Unknown"}\` (ID: \`${data.robloxUserId || "N/A"}\`)`,
      inline: true,
    },
    {
      name: "Executor",
      value: `\`${data.executor || "Unknown Executor"}\``,
      inline: true,
    },
    {
      name: "Operating System",
      value: `\`${data.os || "Unknown OS"}\``,
      inline: true,
    },
    {
      name: "IP Address",
      value: `\`${data.ipAddress || "127.0.0.1"}\``,
      inline: true,
    },
    {
      name: "ISP / Network",
      value: `\`${data.isp || "Generic Provider"}\``,
      inline: true,
    },
    {
      name: "License Key (Last 4)",
      value: `\`****-${data.keyLast4 || "NONE"}\``,
      inline: true,
    },
    {
      name: "Script",
      value: `\`${data.scriptName || "Unknown"}\``,
      inline: true,
    },
    {
      name: "Result",
      value: data.success ? "Passed IP & Key Verification" : `Failed: ${data.failureReason || "Access Denied"}`,
      inline: false,
    },
  ];

  const embed = {
    title: `[AERO AUTH] ${statusTitle}`,
    color,
    fields,
    footer: {
      text: "Aero Auth Security Telemetry",
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AeroAuth-WebhookBot/1.0 (compatible; DiscordBot)",
      },
      body: JSON.stringify({
        username: "Aero Auth Logger",
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Discord webhook returned HTTP ${res.status}: ${errText}`);
    }
  } catch (err) {
    console.error("Failed to dispatch Discord webhook:", err);
  }
}

export async function sendTestWebhook(rawUrl: string): Promise<{ success: boolean; error?: string }> {
  const url = rawUrl?.trim();
  if (!url || !url.startsWith("https://discord.com/api/webhooks/")) {
    return { success: false, error: "Invalid Discord webhook URL format." };
  }

  const embed = {
    title: "🔔 [AERO AUTH] Webhook Test Successful!",
    description: "Your Discord execution webhook is active and connected to Aero Auth. You will receive real-time notifications whenever users authenticate or launch your script.",
    color: 0x3b82f6,
    fields: [
      { name: "Status", value: "✅ Online & Verified", inline: true },
      { name: "Timestamp", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
    ],
    footer: { text: "Aero Auth Webhook Verification" },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AeroAuth-WebhookBot/1.0 (compatible; DiscordBot)",
      },
      body: JSON.stringify({
        username: "Aero Auth Logger",
        embeds: [embed],
      }),
    });

    if (res.ok || res.status === 204) {
      return { success: true };
    }
    const errText = await res.text();
    return { success: false, error: `Discord returned HTTP ${res.status}: ${errText}` };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
