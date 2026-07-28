const { seededPercent, getTargetUserId } = require('../utils');

// All the "xCheck" commands share the same shape: pick a target (replied
// user or self), generate a stable percentage for them, show a bar + line.
const CHECKS = [
  ['hotcheck', '🔥 Hotness'],
  ['stupidcheck', '🤪 Stupidity'],
  ['smartcheck', '🧠 Smartness'],
  ['evilcheck', '😈 Evilness'],
  ['gigachadcheck', '💪 Gigachad'],
  ['simpcheck', '🥺 Simp'],
  ['coolcheck', '😎 Coolness'],
  ['dogcheck', '🐶 Dog energy'],
  ['greatcheck', '🌟 Greatness'],
  ['waifucheck', '💖 Waifu material'],
  ['uncleancheck', '🧼 Uncleanliness']
];

function bar(pct) {
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

module.exports = (registry) => {
  for (const [name, label] of CHECKS) {
    registry.add({
      name,
      category: 'Checks',
      description: `${label} percentage check`,
      handler: async (ctx) => {
        const targetId = getTargetUserId(ctx) || ctx.from.id;
        const targetName = ctx.message.reply_to_message ? ctx.message.reply_to_message.from.first_name : ctx.from.first_name;
        const pct = seededPercent(`${name}-${targetId}-${new Date().toDateString()}`);
        await ctx.reply(`${label} check for ${targetName}:\n${bar(pct)} ${pct}%`);
      }
    });
  }

  registry.add({
    name: 'iq',
    category: 'Checks',
    description: 'IQ check',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx) || ctx.from.id;
      const targetName = ctx.message.reply_to_message ? ctx.message.reply_to_message.from.first_name : ctx.from.first_name;
      const iq = 60 + (seededPercent(`iq-${targetId}-${new Date().toDateString()}`) % 100);
      await ctx.reply(`🧠 ${targetName}'s IQ: ${iq}`);
    }
  });

  registry.add({
    name: 'pp',
    category: 'Checks',
    description: 'Silly PP size check (harmless fun, inches are fictional)',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx) || ctx.from.id;
      const targetName = ctx.message.reply_to_message ? ctx.message.reply_to_message.from.first_name : ctx.from.first_name;
      const size = seededPercent(`pp-${targetId}-${new Date().toDateString()}`) % 15;
      await ctx.reply(`📏 ${targetName}'s size: 8${'='.repeat(size)}D`);
    }
  });

  registry.add({
    name: 'checks',
    category: 'Checks',
    description: 'List every available check command',
    handler: async (ctx) => {
      const names = CHECKS.map(([n]) => `/${n}`).concat(['/iq', '/pp']).join(' ');
      await ctx.reply(`✅ *Available Checks*\n${names}`, { parse_mode: 'Markdown' });
    }
  });
};
