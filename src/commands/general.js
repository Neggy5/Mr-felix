const config = require('../config');
const db = require('../db');
const { fmt } = require('../utils');

module.exports = (registry) => {
  registry.add({
    name: 'start',
    category: 'General',
    description: 'Wake the bot up',
    handler: async (ctx) => {
      db.getUser(ctx.from.id, ctx.from.first_name);
      await ctx.reply(
        `👋 Hey ${ctx.from.first_name}, ${config.BOT_NAME} is online.\n\n` +
        `Use /help or /allcmd to see everything I can do.`
      );
    }
  });

  registry.add({
    name: 'help',
    aliases: ['allcmd'],
    category: 'General',
    description: 'List all commands by category',
    handler: async (ctx) => {
      const cats = registry.byCategory();
      let text = `📋 *ALL COMMANDS — ${config.BOT_NAME.toUpperCase()}*\n`;
      for (const [cat, cmds] of Object.entries(cats)) {
        text += `\n*${cat}*\n`;
        text += cmds.map((c) => `/${c.name}`).join(' ');
        text += '\n';
      }
      await ctx.reply(text, { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'ping',
    category: 'General',
    description: 'Check bot latency',
    handler: async (ctx) => {
      const start = Date.now();
      const msg = await ctx.reply('Pinging...');
      const ms = Date.now() - start;
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `🏓 Pong! ${ms}ms`);
    }
  });

  registry.add({
    name: 'id',
    category: 'General',
    description: 'Get your or a replied user\'s Telegram ID',
    handler: async (ctx) => {
      const target = ctx.message.reply_to_message ? ctx.message.reply_to_message.from : ctx.from;
      await ctx.reply(`👤 Name: ${target.first_name}\n🆔 User ID: \`${target.id}\`\n💬 Chat ID: \`${ctx.chat.id}\``, { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'userinfo',
    aliases: ['whois'],
    category: 'General',
    description: 'Show info about a user',
    handler: async (ctx) => {
      const target = ctx.message.reply_to_message ? ctx.message.reply_to_message.from : ctx.from;
      const u = db.getUser(target.id, target.first_name);
      await ctx.reply(
        `👤 *User Info*\n` +
        `Name: ${target.first_name}\n` +
        `Username: ${target.username ? '@' + target.username : 'none'}\n` +
        `ID: \`${target.id}\`\n` +
        `Level: ${u.level} (${u.xp} XP)\n` +
        `Balance: $${fmt(u.balance)}`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  registry.add({
    name: 'rank',
    category: 'General',
    description: 'Show your XP level',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      const nextLevelXp = u.level * 100;
      await ctx.reply(`🏆 Level ${u.level} — ${u.xp}/${nextLevelXp} XP`);
    }
  });

  registry.add({
    name: 'calc',
    category: 'General',
    description: 'Basic calculator, e.g. /calc 12*(3+4)',
    handler: async (ctx) => {
      const expr = ctx.message.text.split(' ').slice(1).join(' ');
      if (!expr) return ctx.reply('Usage: /calc 2+2');
      if (!/^[0-9+\-*/().\s%]+$/.test(expr)) {
        return ctx.reply('Only numbers and + - * / ( ) % are allowed.');
      }
      try {
        // eslint-disable-next-line no-eval
        const result = eval(expr);
        await ctx.reply(`🧮 ${expr} = ${result}`);
      } catch (e) {
        await ctx.reply('That expression doesn\'t look valid.');
      }
    }
  });

  registry.add({
    name: 'feedback',
    aliases: ['suggest'],
    category: 'General',
    description: 'Send feedback/suggestions to the bot owner',
    handler: async (ctx) => {
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!text) return ctx.reply('Usage: /feedback your message here');
      for (const ownerId of config.OWNER_IDS) {
        ctx.telegram.sendMessage(ownerId, `📩 Feedback from ${ctx.from.first_name} (${ctx.from.id}):\n${text}`).catch(() => {});
      }
      await ctx.reply('✅ Thanks, your feedback was sent to the owner.');
    }
  });

  registry.add({
    name: 'report',
    category: 'General',
    description: 'Report a problem to the bot owner',
    handler: async (ctx) => {
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!text) return ctx.reply('Usage: /report describe the issue');
      for (const ownerId of config.OWNER_IDS) {
        ctx.telegram.sendMessage(ownerId, `🚨 Report from ${ctx.from.first_name} (${ctx.from.id}) in chat ${ctx.chat.id}:\n${text}`).catch(() => {});
      }
      await ctx.reply('✅ Report sent to the owner.');
    }
  });
};
