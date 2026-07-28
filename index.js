const { Telegraf } = require('telegraf');
const express = require('express');
const config = require('./config');
const db = require('./db');
const { createRegistry } = require('./registry');
const { forceJoinMiddleware, registerJoinCallback } = require('./forceJoin');
const { registerModerationActions } = require('./moderationActions');

if (!config.BOT_TOKEN || config.BOT_TOKEN === 'PASTE_YOUR_BOT_TOKEN_HERE') {
  console.error('Missing BOT_TOKEN. Open src/config.js and paste your token from @BotFather.');
  process.exit(1);
}

const bot = new Telegraf(config.BOT_TOKEN);
const registry = createRegistry();

// Gate every command behind the "must join our channel + group" check.
// Must be registered before the command handlers below so it runs first.
bot.use(forceJoinMiddleware());
registerJoinCallback(bot);
registerModerationActions(bot);

// Load every command module.
[
  require('./commands/general'),
  require('./commands/moderation'),
  require('./commands/economy'),
  require('./commands/games'),
  require('./commands/checks'),
  require('./commands/social'),
  require('./commands/ai'),
  require('./commands/downloads'),
  require('./commands/pvp')
].forEach((register) => register(registry));

// Register every command (and its aliases) with Telegraf.
for (const cmd of registry.all()) {
  const names = [cmd.name, ...(cmd.aliases || [])];
  for (const name of names) {
    bot.command(name, async (ctx) => {
      try {
        await cmd.handler(ctx);
      } catch (err) {
        console.error(`Error in /${name}:`, err);
        ctx.reply('⚠️ Something went wrong running that command.').catch(() => {});
      }
    });
  }
}

// ---- passive middleware: welcome/goodbye, filters, badwords, antilink, afk ----

bot.on('new_chat_members', async (ctx) => {
  const g = db.getGroup(ctx.chat.id, ctx.chat.title);
  for (const member of ctx.message.new_chat_members) {
    const text = (g.welcome || 'Welcome {name}! 👋').replace('{name}', member.first_name);
    await ctx.reply(text).catch(() => {});
  }
});

bot.on('left_chat_member', async (ctx) => {
  const g = db.getGroup(ctx.chat.id, ctx.chat.title);
  const member = ctx.message.left_chat_member;
  const text = (g.goodbye || 'Goodbye {name}. 👋').replace('{name}', member.first_name);
  await ctx.reply(text).catch(() => {});
});

bot.on('text', async (ctx, next) => {
  // Ignore actual commands here, they're handled above.
  if (ctx.message.text.startsWith('/')) return next();
  if (ctx.chat.type === 'private') return next();

  const g = db.getGroup(ctx.chat.id, ctx.chat.title);
  const lower = ctx.message.text.toLowerCase();

  // filters (auto-replies)
  if (g.filters[lower]) {
    await ctx.reply(g.filters[lower]).catch(() => {});
  }

  // bad word auto-delete
  if (g.settings.antibadword && g.badwords.some((w) => lower.includes(w))) {
    await ctx.deleteMessage().catch(() => {});
    return;
  }

  // basic antilink
  if (g.settings.antilink && /(https?:\/\/|t\.me\/|www\.)/i.test(lower)) {
    const isAdmin = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id)
      .then((m) => ['administrator', 'creator'].includes(m.status))
      .catch(() => false);
    if (!isAdmin) {
      await ctx.deleteMessage().catch(() => {});
      return;
    }
  }

  // AFK notice
  const u = db.getUser(ctx.from.id, ctx.from.first_name);
  if (u.afk) {
    u.afk = null;
    db.save();
    await ctx.reply(`👋 Welcome back ${ctx.from.first_name}, I removed your AFK status.`).catch(() => {});
  }
  if (ctx.message.reply_to_message) {
    const repliedId = ctx.message.reply_to_message.from.id;
    const repliedUser = db.getUser(repliedId);
    if (repliedUser.afk) {
      await ctx.reply(`💤 ${repliedUser.name} is AFK: ${repliedUser.afk.reason}`).catch(() => {});
    }
  }

  next();
});

bot.catch((err, ctx) => {
  console.error(`Unhandled error for ${ctx.updateType}:`, err);
});

// ---- health check server (Railway pings this) ----
const app = express();
app.get('/', (req, res) => res.send('zuko MD is running.'));
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.listen(config.PORT, () => console.log(`Health check server listening on port ${config.PORT}`));

bot.launch().then(() => console.log(`${config.BOT_NAME} is up and polling Telegram.`));

process.once('SIGINT', () => { db.saveNow(); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { db.saveNow(); bot.stop('SIGTERM'); });
