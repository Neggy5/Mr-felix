const db = require('../db');
const { getTargetUserId, rand } = require('../utils');

module.exports = (registry) => {
  registry.add({
    name: 'marry',
    category: 'Social',
    description: 'Propose to a user (reply to them, needs a wedding ring from /shop)',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      if (!targetId || targetId === ctx.from.id) return ctx.reply('Reply to the user you want to marry.');
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      const t = db.getUser(targetId);
      if (u.marriedTo) return ctx.reply('You\'re already married! Use /divorce first.');
      if (t.marriedTo) return ctx.reply('They\'re already married.');
      if (!u.inventory.includes('ring')) return ctx.reply('You need a wedding ring first — buy one from /shop.');
      u.inventory = u.inventory.filter((i) => i !== 'ring');
      u.marriedTo = targetId;
      t.marriedTo = ctx.from.id;
      db.save();
      await ctx.reply(`💍 ${u.name} and ${t.name} are now married! Congratulations!`);
    }
  });

  registry.add({
    name: 'divorce',
    category: 'Social',
    description: 'End your marriage',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (!u.marriedTo) return ctx.reply('You\'re not married.');
      const t = db.getUser(u.marriedTo);
      t.marriedTo = null;
      u.marriedTo = null;
      db.save();
      await ctx.reply('💔 You are now divorced.');
    }
  });

  registry.add({
    name: 'spouse',
    category: 'Social',
    description: 'Check who you\'re married to',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (!u.marriedTo) return ctx.reply('You\'re not married yet.');
      const t = db.getUser(u.marriedTo);
      await ctx.reply(`💑 You're married to ${t.name}.`);
    }
  });

  registry.add({
    name: 'ship',
    category: 'Social',
    description: 'Ship two users together (reply to one, or pass two names)',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      const targetName = targetId ? (ctx.message.reply_to_message?.from?.first_name || 'them') : ctx.message.text.split(' ').slice(1).join(' ');
      if (!targetName) return ctx.reply('Reply to a user, or /ship Name1 Name2.');
      const pct = rand(1, 100);
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      await ctx.reply(`💘 ${ctx.from.first_name} × ${targetName}\n${bar} ${pct}%`);
    }
  });

  registry.add({
    name: 'dm',
    category: 'Social',
    description: 'Ask the bot to DM a user (they must have started the bot first)',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!targetId || !text) return ctx.reply('Reply to a user and add a message: /dm hello!');
      try {
        await ctx.telegram.sendMessage(targetId, `✉️ Message from ${ctx.from.first_name}: ${text}`);
        await ctx.reply('✅ Sent.');
      } catch (e) {
        await ctx.reply('Couldn\'t deliver — Telegram only allows bots to message users who have started a chat with the bot first.');
      }
    }
  });

  registry.add({
    name: 'afk',
    category: 'Social',
    description: 'Mark yourself as AFK: /afk sleeping',
    handler: async (ctx) => {
      const reason = ctx.message.text.split(' ').slice(1).join(' ') || 'AFK';
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      u.afk = { reason, since: Date.now() };
      db.save();
      await ctx.reply(`💤 ${ctx.from.first_name} is now AFK: ${reason}`);
    }
  });
};
