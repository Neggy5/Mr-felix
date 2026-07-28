const { requireAdmin } = require('./utils');

// Handles taps on the destructive/secondary confirm buttons sent by
// /ban and /kick in commands/moderation.js.
function registerModerationActions(bot) {
  bot.action(/^modconfirm:(ban|kick):(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) {
      return ctx.answerCbQuery('Admins only.', { show_alert: true });
    }
    const [, action, targetStr] = ctx.match;
    const target = Number(targetStr);
    try {
      await ctx.telegram.banChatMember(ctx.chat.id, target);
      if (action === 'kick') await ctx.telegram.unbanChatMember(ctx.chat.id, target);
      await ctx.answerCbQuery(action === 'ban' ? 'Banned.' : 'Kicked.');
      await ctx.editMessageText(
        action === 'ban' ? `🔨 Banned user ${target}.` : `👢 Kicked user ${target}.`
      );
    } catch (e) {
      await ctx.answerCbQuery('Failed - see message.', { show_alert: true });
      await ctx.editMessageText(`Couldn't ${action}: ${e.description || e.message}`).catch(() => {});
    }
  });

  bot.action('modconfirm:cancel', async (ctx) => {
    await ctx.answerCbQuery('Cancelled.');
    await ctx.editMessageText('Cancelled - no action taken.');
  });
}

module.exports = { registerModerationActions };
