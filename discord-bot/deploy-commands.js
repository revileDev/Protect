// discord-bot/deploy-commands.js
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const token = process.env.DISCORD_BOT_TOKEN || config.token;
const clientId = process.env.DISCORD_CLIENT_ID || config.clientId;
const guildId = process.env.DISCORD_GUILD_ID || config.guildId;

if (!token || !clientId) {
  console.error("Missing token or clientId in config.json or environment variables.");
  console.error("Please add your Discord bot token and Client ID to config.json.");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure verification and auto-roles (Owner / Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setuptickets")
    .setDescription("Configure ticket panel, category, transcripts, and helper role (Owner / Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("update")
    .setDescription("Find all members with no roles and assign a role to them (Admin only)")
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role to assign to members without roles (leave blank to select interactively)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("updatesecond")
    .setDescription("Transfer all members from one role to another role (Admin only)")
    .addRoleOption((option) =>
      option
        .setName("from")
        .setDescription("The role to transfer members FROM (leave blank to select interactively)")
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName("to")
        .setDescription("The role to transfer members TO (leave blank to select interactively)")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("remove_old_role")
        .setDescription("Remove the old role after adding the new one? (Default: True)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("Started registering application slash commands...");

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`Successfully registered slash commands for guild: ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log("Successfully registered global slash commands.");
    }
  } catch (error) {
    console.error("Error deploying commands:", error);
  }
})();
