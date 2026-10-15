// discord-bot/bot.js
const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  EmbedBuilder,
  PermissionsBitField,
  AttachmentBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "config.json");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {
      token: "",
      clientId: "",
      guildId: "",
      verification: {},
      tickets: {},
    };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf8");
}

let config = loadConfig();
const token = process.env.DISCORD_BOT_TOKEN || config.token;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// Setup state caches for interactive wizards
const setupSessions = new Map();
const ticketSetupSessions = new Map();

client.once("ready", () => {
  console.log(`[AeroBot] Logged in as ${client.user.tag}`);
});

// ============================================================================
// 1. AUTOROLE & LOGGING ON MEMBER JOIN
// ============================================================================
client.on("guildMemberAdd", async (member) => {
  try {
    config = loadConfig();

    // 1. Assign Join Role
    const joinRoleId = config.verification?.joinRoleId;
    if (joinRoleId) {
      const role = member.guild.roles.cache.get(joinRoleId);
      if (role) {
        await member.roles.add(role);
        console.log(`[AeroBot] Assigned auto-role ${role.name} to ${member.user.tag}`);
      }
    }

    // 2. Post Join Log
    const logsChannelId = config.verification?.logsChannelId;
    if (logsChannelId) {
      const logChannel = member.guild.channels.cache.get(logsChannelId);
      if (logChannel && logChannel.isTextBased()) {
        const createdTimestampSec = Math.floor(member.user.createdTimestamp / 1000);
        const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));

        const joinEmbed = new EmbedBuilder()
          .setAuthor({
            name: `${member.user.tag}`,
            iconURL: member.user.displayAvatarURL({ dynamic: true }),
          })
          .setTitle("📥 Member Joined")
          .setDescription(`${member} has joined the server.`)
          .addFields(
            {
              name: "User ID",
              value: `\`${member.user.id}\``,
              inline: true,
            },
            {
              name: "Account Created",
              value: `<t:${createdTimestampSec}:R> (${accountAgeDays}d ago)`,
              inline: true,
            },
            {
              name: "Member Count",
              value: `**#${member.guild.memberCount}**`,
              inline: true,
            }
          )
          .setColor(0x10b981) // Emerald Green
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setTimestamp();

        await logChannel.send({ embeds: [joinEmbed] });
      }
    }
  } catch (err) {
    console.error("[AeroBot] Error on guildMemberAdd:", err);
  }
});

// ============================================================================
// LOGGING ON MEMBER LEAVE
// ============================================================================
client.on("guildMemberRemove", async (member) => {
  try {
    config = loadConfig();
    const logsChannelId = config.verification?.logsChannelId;
    if (!logsChannelId) return;

    const logChannel = member.guild.channels.cache.get(logsChannelId);
    if (logChannel && logChannel.isTextBased()) {
      const joinedTimestampSec = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
      const daysInServer = member.joinedTimestamp
        ? Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24))
        : null;

      const roles = member.roles?.cache
        ?.filter((r) => r.id !== member.guild.id)
        ?.map((r) => `<@&${r.id}>`)
        ?.join(" ") || "None";

      const leaveEmbed = new EmbedBuilder()
        .setAuthor({
          name: `${member.user.tag}`,
          iconURL: member.user.displayAvatarURL({ dynamic: true }),
        })
        .setTitle("📤 Member Left")
        .setDescription(`**${member.user.tag}** left or was removed from the server.`)
        .addFields(
          {
            name: "User ID",
            value: `\`${member.user.id}\``,
            inline: true,
          },
          {
            name: "Stayed For",
            value: joinedTimestampSec ? `<t:${joinedTimestampSec}:R> (${daysInServer}d)` : "Unknown",
            inline: true,
          },
          {
            name: "Member Count",
            value: `**${member.guild.memberCount}**`,
            inline: true,
          },
          {
            name: "Roles Held",
            value: roles.length > 1024 ? `${roles.substring(0, 1020)}...` : roles,
            inline: false,
          }
        )
        .setColor(0xf43f5e) // Rose Red
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setTimestamp();

      await logChannel.send({ embeds: [leaveEmbed] });
    }
  } catch (err) {
    console.error("[AeroBot] Error on guildMemberRemove:", err);
  }
});

// ============================================================================
// HELPER: BULK ASSIGN ROLE TO MEMBERS WITHOUT ROLES
// ============================================================================
async function assignRoleToMembersWithoutRoles(interaction, targetRole) {
  const botMember = await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return interaction.editReply({
      content: "❌ The bot lacks the **Manage Roles** permission. Please grant the bot this permission in server settings and try again.",
      components: [],
    });
  }

  if (targetRole.id === interaction.guild.id) {
    return interaction.editReply({
      content: "❌ You cannot assign the `@everyone` role.",
      components: [],
    });
  }

  if (targetRole.managed) {
    return interaction.editReply({
      content: `❌ The role **${targetRole.name}** is managed by an integration or bot and cannot be assigned manually.`,
      components: [],
    });
  }

  if (targetRole.position >= botMember.roles.highest.position) {
    return interaction.editReply({
      content: `❌ The role **${targetRole.name}** is positioned higher than or equal to my highest role (**${botMember.roles.highest.name}**). Please move my bot role higher in Server Settings > Roles.`,
      components: [],
    });
  }

  await interaction.editReply({
    content: "🔍 Fetching all server members and identifying users without roles...",
    components: [],
  });

  const allMembers = await interaction.guild.members.fetch();
  const noRoleMembers = allMembers.filter(
    (m) => !m.user.bot && m.roles.cache.filter((r) => r.id !== interaction.guild.id).size === 0
  );

  if (noRoleMembers.size === 0) {
    return interaction.editReply({
      content: `✅ All members in **${interaction.guild.name}** already have at least one role assigned. No actions taken.`,
      components: [],
    });
  }

  const total = noRoleMembers.size;
  await interaction.editReply({
    content: `⏳ Found **${total}** member(s) with no roles. Assigning <@&${targetRole.id}>...`,
    components: [],
  });

  let assignedCount = 0;
  let failedCount = 0;

  for (const [, member] of noRoleMembers) {
    try {
      await member.roles.add(targetRole);
      assignedCount++;
    } catch (err) {
      console.error(`[AeroBot] Failed to assign role to ${member.user.tag}:`, err);
      failedCount++;
    }

    if (total > 5) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("Role Update Complete")
    .setColor(0x10b981)
    .setDescription(`Successfully processed role assignment for members without roles.`)
    .addFields(
      { name: "Target Role", value: `<@&${targetRole.id}>`, inline: true },
      { name: "Successfully Assigned", value: `**${assignedCount}** / ${total}`, inline: true },
      { name: "Failed", value: `${failedCount}`, inline: true }
    )
    .setTimestamp();

  return interaction.editReply({
    content: null,
    embeds: [embed],
    components: [],
  });
}

// ============================================================================
// 2. SLASH COMMAND INTERACTIONS
// ============================================================================
client.on("interactionCreate", async (interaction) => {
  // Check if owner or admin
  const isOwner =
    interaction.guild?.ownerId === interaction.user.id ||
    interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);

  // --------------------------------------------------------------------------
  // /setup (Verification & Join/Leave Logs Wizard)
  // --------------------------------------------------------------------------
  if (interaction.isChatInputCommand() && interaction.commandName === "setup") {
    if (!isOwner) {
      return interaction.reply({
        content: "Only the server owner or administrators can run this setup command.",
        ephemeral: true,
      });
    }

    setupSessions.set(interaction.user.id, { step: 1, data: {} });

    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId("setup_select_verify_channel")
      .setPlaceholder("Select the channel where users will verify")
      .setChannelTypes([ChannelType.GuildText]);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    return interaction.reply({
      content: "**Step 1/4:** Which channel should users verify in?",
      components: [row],
      ephemeral: true,
    });
  }

  // Step 1 -> Step 2: Verification Channel -> Select Join/Leave Logs Channel
  if (interaction.isChannelSelectMenu() && interaction.customId === "setup_select_verify_channel") {
    const session = setupSessions.get(interaction.user.id);
    if (!session) return;

    session.data.channelId = interaction.values[0];
    session.step = 2;

    const logsSelect = new ChannelSelectMenuBuilder()
      .setCustomId("setup_select_logs_channel")
      .setPlaceholder("Select channel where member joins and leaves will be logged")
      .setChannelTypes([ChannelType.GuildText]);

    const row = new ActionRowBuilder().addComponents(logsSelect);

    return interaction.update({
      content: `**Step 2/4:** Verification channel set to <#${session.data.channelId}>.\nNow select the channel where **member joins and leaves** should be logged:`,
      components: [row],
    });
  }

  // Step 2 -> Step 3: Logs Channel -> Select Initial Join Role
  if (interaction.isChannelSelectMenu() && interaction.customId === "setup_select_logs_channel") {
    const session = setupSessions.get(interaction.user.id);
    if (!session) return;

    session.data.logsChannelId = interaction.values[0];
    session.step = 3;

    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId("setup_select_join_role")
      .setPlaceholder("Select role given when users first join");

    const row = new ActionRowBuilder().addComponents(roleSelect);

    return interaction.update({
      content: `**Step 3/4:** Join/Leave logs channel set to <#${session.data.logsChannelId}>.\nNow select the role users should be given when they first join:`,
      components: [row],
    });
  }

  // Step 3 -> Step 4: Join Role -> Select Verified Role
  if (interaction.isRoleSelectMenu() && interaction.customId === "setup_select_join_role") {
    const session = setupSessions.get(interaction.user.id);
    if (!session) return;

    session.data.joinRoleId = interaction.values[0];
    session.step = 4;

    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId("setup_select_verified_role")
      .setPlaceholder("Select role given after users verify");

    const row = new ActionRowBuilder().addComponents(roleSelect);

    return interaction.update({
      content: `**Step 4/4:** Initial join role set to <@&${session.data.joinRoleId}>.\nNow select the role given to users after they verify:`,
      components: [row],
    });
  }

  // Step 4 (Finalize): Verified Role
  if (interaction.isRoleSelectMenu() && interaction.customId === "setup_select_verified_role") {
    const session = setupSessions.get(interaction.user.id);
    if (!session) return;

    session.data.verifiedRoleId = interaction.values[0];

    // Save config
    config = loadConfig();
    config.verification = {
      channelId: session.data.channelId,
      logsChannelId: session.data.logsChannelId,
      joinRoleId: session.data.joinRoleId,
      verifiedRoleId: session.data.verifiedRoleId,
    };
    saveConfig(config);
    setupSessions.delete(interaction.user.id);

    // Send verification embed to target channel
    const targetChannel = interaction.guild.channels.cache.get(session.data.channelId);
    if (targetChannel && targetChannel.isTextBased()) {
      const verifyEmbed = new EmbedBuilder()
        .setTitle("Server Verification")
        .setDescription(
          "Click the **Verify** button below to complete verification and gain access to the server."
        )
        .setColor(0x00a2ff);

      const verifyButton = new ButtonBuilder()
        .setCustomId("button_verify_member")
        .setLabel("Verify")
        .setStyle(ButtonStyle.Success);

      const buttonRow = new ActionRowBuilder().addComponents(verifyButton);

      await targetChannel.send({ embeds: [verifyEmbed], components: [buttonRow] });
    }

    return interaction.update({
      content: `Verification & Logging setup complete.\n• Verify Channel: <#${session.data.channelId}>\n• Join/Leave Logs: <#${session.data.logsChannelId}>\n• Initial Join Role: <@&${session.data.joinRoleId}>\n• Verified Role: <@&${session.data.verifiedRoleId}>\nVerification panel posted in <#${session.data.channelId}>.`,
      components: [],
    });
  }

  // --------------------------------------------------------------------------
  // /setuptickets (Tickets Wizard)
  // --------------------------------------------------------------------------
  if (interaction.isChatInputCommand() && interaction.commandName === "setuptickets") {
    if (!isOwner) {
      return interaction.reply({
        content: "Only the server owner or administrators can run this setup command.",
        ephemeral: true,
      });
    }

    ticketSetupSessions.set(interaction.user.id, { step: 1, data: {} });

    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId("tickets_select_panel_channel")
      .setPlaceholder("Select channel where users will create tickets from")
      .setChannelTypes([ChannelType.GuildText]);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    return interaction.reply({
      content: "**Step 1/4:** Which channel should users create tickets from?",
      components: [row],
      ephemeral: true,
    });
  }

  // Step 1: Panel Channel
  if (interaction.isChannelSelectMenu() && interaction.customId === "tickets_select_panel_channel") {
    const session = ticketSetupSessions.get(interaction.user.id);
    if (!session) return;

    session.data.panelChannelId = interaction.values[0];
    session.step = 2;

    const categorySelect = new ChannelSelectMenuBuilder()
      .setCustomId("tickets_select_category")
      .setPlaceholder("Select category for active tickets")
      .setChannelTypes([ChannelType.GuildCategory]);

    const row = new ActionRowBuilder().addComponents(categorySelect);

    return interaction.update({
      content: `**Step 2/4:** Ticket creation channel set to <#${session.data.panelChannelId}>.\nNow select the category for active tickets:`,
      components: [row],
    });
  }

  // Step 2: Category
  if (interaction.isChannelSelectMenu() && interaction.customId === "tickets_select_category") {
    const session = ticketSetupSessions.get(interaction.user.id);
    if (!session) return;

    session.data.categoryId = interaction.values[0];
    session.step = 3;

    const transcriptSelect = new ChannelSelectMenuBuilder()
      .setCustomId("tickets_select_transcript_channel")
      .setPlaceholder("Select channel for ticket transcripts")
      .setChannelTypes([ChannelType.GuildText]);

    const row = new ActionRowBuilder().addComponents(transcriptSelect);

    return interaction.update({
      content: `**Step 3/4:** Active category selected.\nNow select where ticket transcripts should go:`,
      components: [row],
    });
  }

  // Step 3: Transcript Channel
  if (interaction.isChannelSelectMenu() && interaction.customId === "tickets_select_transcript_channel") {
    const session = ticketSetupSessions.get(interaction.user.id);
    if (!session) return;

    session.data.transcriptChannelId = interaction.values[0];
    session.step = 4;

    const helperRoleSelect = new RoleSelectMenuBuilder()
      .setCustomId("tickets_select_helper_role")
      .setPlaceholder("Select the role for Ticket Helpers / Staff");

    const row = new ActionRowBuilder().addComponents(helperRoleSelect);

    return interaction.update({
      content: `**Step 4/4:** Transcript channel set to <#${session.data.transcriptChannelId}>.\nNow select the Ticket Helper role (staff with access to tickets):`,
      components: [row],
    });
  }

  // Step 4: Helper Role (Finalize Tickets)
  if (interaction.isRoleSelectMenu() && interaction.customId === "tickets_select_helper_role") {
    const session = ticketSetupSessions.get(interaction.user.id);
    if (!session) return;

    session.data.helperRoleId = interaction.values[0];

    // Save ticket config
    config = loadConfig();
    config.tickets = {
      panelChannelId: session.data.panelChannelId,
      categoryId: session.data.categoryId,
      transcriptChannelId: session.data.transcriptChannelId,
      helperRoleId: session.data.helperRoleId,
    };
    saveConfig(config);
    ticketSetupSessions.delete(interaction.user.id);

    // Send ticket creation embed to panel channel
    const panelChannel = interaction.guild.channels.cache.get(session.data.panelChannelId);
    if (panelChannel && panelChannel.isTextBased()) {
      const ticketEmbed = new EmbedBuilder()
        .setTitle("Support Tickets")
        .setDescription("Need support or have inquiries? Click below to open a private ticket.")
        .setColor(0x5865f2);

      const ticketButton = new ButtonBuilder()
        .setCustomId("button_create_ticket")
        .setLabel("Open Ticket")
        .setEmoji("📩")
        .setStyle(ButtonStyle.Primary);

      const buttonRow = new ActionRowBuilder().addComponents(ticketButton);

      await panelChannel.send({ embeds: [ticketEmbed], components: [buttonRow] });
    }

    return interaction.update({
      content: `Ticket system setup complete.\n• Panel: <#${session.data.panelChannelId}>\n• Category: <#${session.data.categoryId}>\n• Transcripts: <#${session.data.transcriptChannelId}>\n• Helper Role: <@&${session.data.helperRoleId}>\nTicket panel posted in <#${session.data.panelChannelId}>.`,
      components: [],
    });
  }

  // --------------------------------------------------------------------------
  // /update (Bulk assign role to members without any roles)
  // --------------------------------------------------------------------------
  if (interaction.isChatInputCommand() && interaction.commandName === "update") {
    if (!isOwner) {
      return interaction.reply({
        content: "Only the server owner or administrators can run this update command.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const targetRole = interaction.options.getRole("role");
    if (targetRole) {
      return assignRoleToMembersWithoutRoles(interaction, targetRole);
    }

    // If no role was passed directly in the command, fetch members and show interactive dropdown
    const allMembers = await interaction.guild.members.fetch();
    const noRoleMembers = allMembers.filter(
      (m) => !m.user.bot && m.roles.cache.filter((r) => r.id !== interaction.guild.id).size === 0
    );

    if (noRoleMembers.size === 0) {
      return interaction.editReply({
        content: `✅ All members in **${interaction.guild.name}** already have at least one role assigned. No actions needed.`,
      });
    }

    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId("update_select_assign_role")
      .setPlaceholder("Select a role to assign to all roleless members");

    const row = new ActionRowBuilder().addComponents(roleSelect);

    return interaction.editReply({
      content: `Found **${noRoleMembers.size}** member(s) with no roles assigned.\nSelect the role you would like to assign to all of them below:`,
      components: [row],
    });
  }

  // Handle Role Selection menu from /update
  if (interaction.isRoleSelectMenu() && interaction.customId === "update_select_assign_role") {
    if (!isOwner) {
      return interaction.reply({
        content: "Only the server owner or administrators can perform this action.",
        ephemeral: true,
      });
    }

    await interaction.deferUpdate();

    const selectedRoleId = interaction.values[0];
    const targetRole = interaction.guild.roles.cache.get(selectedRoleId);

    if (!targetRole) {
      return interaction.editReply({
        content: "❌ Selected role could not be found.",
        components: [],
      });
    }

    return assignRoleToMembersWithoutRoles(interaction, targetRole);
  }

  // --------------------------------------------------------------------------
  // 3. BUTTON: VERIFY MEMBER
  // --------------------------------------------------------------------------
  if (interaction.isButton() && interaction.customId === "button_verify_member") {
    config = loadConfig();
    const verifiedRoleId = config.verification?.verifiedRoleId;
    const joinRoleId = config.verification?.joinRoleId;

    if (!verifiedRoleId) {
      return interaction.reply({
        content: "Verification role is not configured yet. Please contact an administrator.",
        ephemeral: true,
      });
    }

    try {
      const member = interaction.member;
      const verifiedRole = interaction.guild.roles.cache.get(verifiedRoleId);

      if (verifiedRole) {
        await member.roles.add(verifiedRole);
      }
      if (joinRoleId) {
        const joinRole = interaction.guild.roles.cache.get(joinRoleId);
        if (joinRole && member.roles.cache.has(joinRoleId)) {
          await member.roles.remove(joinRole);
        }
      }

      return interaction.reply({
        content: "Verification complete. Access granted.",
        ephemeral: true,
      });
    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: "Could not assign verified role. Ensure the bot role is positioned above the target role.",
        ephemeral: true,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 4. BUTTON: CREATE TICKET
  // --------------------------------------------------------------------------
  if (interaction.isButton() && interaction.customId === "button_create_ticket") {
    config = loadConfig();
    const categoryId = config.tickets?.categoryId;
    const helperRoleId = config.tickets?.helperRoleId;

    // Check if user already has an open ticket
    const existingTicket = interaction.guild.channels.cache.find(
      (c) => c.name === `ticket-${interaction.user.username.toLowerCase()}` && c.parentId === categoryId
    );

    if (existingTicket) {
      return interaction.reply({
        content: `You already have an open ticket in <#${existingTicket.id}>.`,
        ephemeral: true,
      });
    }

    try {
      const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;

      const permissionOverwrites = [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        },
        {
          id: client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageChannels,
          ],
        },
      ];

      if (helperRoleId) {
        permissionOverwrites.push({
          id: helperRoleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageMessages,
          ],
        });
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId || undefined,
        permissionOverwrites,
      });

      const ticketWelcome = new EmbedBuilder()
        .setTitle(`Ticket: ${interaction.user.username}`)
        .setDescription(
          `Welcome <@${interaction.user.id}>. Describe your issue or question below.\nSupport staff with <@&${helperRoleId || "Helper"}> have access to assist you.`
        )
        .setColor(0x5865f2)
        .setTimestamp();

      const closeButton = new ButtonBuilder()
        .setCustomId("button_close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(closeButton);

      await ticketChannel.send({
        content: `<@${interaction.user.id}> ${helperRoleId ? `<@&${helperRoleId}>` : ""}`,
        embeds: [ticketWelcome],
        components: [row],
      });

      return interaction.reply({
        content: `Ticket created: <#${ticketChannel.id}>`,
        ephemeral: true,
      });
    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: "Error creating ticket channel. Check bot channel management permissions.",
        ephemeral: true,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 5. BUTTON: CLOSE TICKET & SAVE TRANSCRIPT
  // --------------------------------------------------------------------------
  if (interaction.isButton() && interaction.customId === "button_close_ticket") {
    config = loadConfig();
    const transcriptChannelId = config.tickets?.transcriptChannelId;

    await interaction.reply({
      content: "Saving transcript and closing ticket in 5 seconds...",
    });

    try {
      // Fetch messages for transcript
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const sorted = Array.from(messages.values()).reverse();

      let transcriptText = `--- TICKET TRANSCRIPT ---\n`;
      transcriptText += `Channel: #${interaction.channel.name}\n`;
      transcriptText += `Closed by: ${interaction.user.tag}\n`;
      transcriptText += `Date: ${new Date().toISOString()}\n`;
      transcriptText += `-------------------------\n\n`;

      sorted.forEach((m) => {
        transcriptText += `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}\n`;
      });

      if (transcriptChannelId) {
        const transcriptChannel = interaction.guild.channels.cache.get(transcriptChannelId);
        if (transcriptChannel && transcriptChannel.isTextBased()) {
          const attachment = new AttachmentBuilder(Buffer.from(transcriptText, "utf-8"), {
            name: `${interaction.channel.name}-transcript.txt`,
          });

          const logEmbed = new EmbedBuilder()
            .setTitle("Ticket Closed")
            .addFields(
              { name: "Ticket", value: interaction.channel.name, inline: true },
              { name: "Closed By", value: interaction.user.tag, inline: true }
            )
            .setColor(0xef4444)
            .setTimestamp();

          await transcriptChannel.send({ embeds: [logEmbed], files: [attachment] });
        }
      }

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (e) {
          console.error("Error deleting channel:", e);
        }
      }, 5000);
    } catch (err) {
      console.error("Error generating transcript:", err);
    }
  }
});

if (token) {
  client.login(token).catch((err) => {
    console.log("[AeroBot] Bot token not connected yet. Set token in config.json to start.");
  });
} else {
  console.log("[AeroBot] No token provided in config.json. Add token to start bot.");
}
