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
  if (!data.webhookUrl || !data.webhookUrl.startsWith("http")) return;

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
    await fetch(data.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Aero Auth Logger",
        embeds: [embed],
      }),
    });
  } catch (err) {
    console.error("Failed to dispatch Discord webhook:", err);
  }
}
