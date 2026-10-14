# Discord Verification, Auto-Role, and Tickets Bot

A utility bot for Discord server verification, member auto-roles, and private support tickets with transcripts.

## Commands

Both commands are restricted to the server owner and administrators:

* `/setup`: Interactive 4-step setup:
  1. Select verification channel.
  2. Select member join and leave logging channel.
  3. Select initial join role (auto-role given on join).
  4. Select verified role (given when user clicks Verify).
  * Automatically sends a verification panel with a **Verify** button into the chosen channel.
  * Logs rich member join embeds (with account age and member count).
  * Logs rich member leave embeds (with stay duration and roles held).
  * Auto-assigns the join role when new members join the server.
  * Swaps the join role for the verified role when members click **Verify**.

* `/setuptickets`: Interactive 4-step setup:
  1. Select channel where users create tickets from.
  2. Select category for active tickets.
  3. Select transcript channel where logs are sent on close.
  4. Select role for Ticket Helpers (staff who can view and manage tickets).
  * Automatically sends a ticket creation panel with an **Open Ticket** button.
  * Creates private channels with permissions configured for the user, helper role, and bot.
  * Generates and logs full transcripts when closed before deleting the channel.

## Quick Setup

1. Open [Discord Developer Portal](https://discord.com/developers/applications) and create a bot.
2. Under the **Bot** tab, enable Privileged Gateway Intents:
   * **Server Members Intent** (required for auto-role and verification)
   * **Message Content Intent** (required for transcripts)
3. Copy your Bot Token and Application (Client) ID.
4. Edit `discord-bot/config.json`:
   ```json
   {
     "token": "YOUR_BOT_TOKEN_HERE",
     "clientId": "YOUR_CLIENT_ID_HERE",
     "guildId": "YOUR_SERVER_ID_HERE"
   }
   ```
5. Register slash commands:
   ```bash
   npm run deploy
   ```
6. Start the bot:
   ```bash
   npm start
   ```
7. In Discord, run `/setup` and `/setuptickets`.
