const { Markup } = require('telegraf');
const config = require('./config');

// A quick note on "blue buttons": Telegram's Bot API doesn't let a bot set
// custom colors on inline buttons - that styling is controlled entirely by
// each user's client theme, not by the bot. URL buttons already render as
// the client's link color (blue by default in the standard Telegram app on
// iOS/Android/Desktop/Web), so as long as you're on default themes this
// will already look blue with zero extra work.

function buildJoinKeyboard() {
  const rows = [];
  const { channel, group } = config.FORCE_JOIN;
  if (channel?.url) rows.push([Markup.button.url(channel.label || '📢 Join Channel', channel.url)]);
  if (group?.url) rows.push([Markup.button.url(group.label || '💬 Join Group', group.url)]);
  rows.push([Markup.button.callback('✅ I\'ve Joined', 'check_join')]);
  return Markup.inlineKeyboard(rows);
}

async function isMember(telegram, chatId, userId) {
  try {
    const member = await telegram.getChatMember(chatId, userId);
    return !['left', 'kicked'].includes(member.status);
  } catch (e) {
    // If the bot can't check (not an admin, chat doesn't exist, wrong
    // id/username, etc.) fail OPEN so a misconfiguration doesn't lock
    // everyone out completely. The error is logged so it's easy to spot.
    console.error(`Force-join check failed for chat ${chatId}:`, e.description || e.message);
    return true;
  }
}

async function checkAllJoined(telegram, userId) {
  const { channel, group } = config.FORCE_JOIN;
  const checks = [];
  if (channel?.id) checks.push(isMember(telegram, channel.id, userId));
  if (group?.id) checks.push(isMember(telegram, group.id, userId));
  const results = await Promise.all(checks);
  return results.every(Boolean);
}

// Telegraf middleware: blocks any command until the user has joined both
// the configured channel and group. Non-command messages pass through
// untouched so normal group chat isn't affected.
function forceJoinMiddleware() {
  return async (ctx, next) => {
    if (!config.FORCE_JOIN.enabled) return next();
    const isCommand = ctx.message?.text?.startsWith('/');
    if (!isCommand) return next();

    const joined = await checkAllJoined(ctx.telegram, ctx.from.id);
    if (joined) return next();

    await ctx.reply(
      `🔒 You need to join our channel and group before using ${config.BOT_NAME}.\n\nTap both buttons below, then hit "I've Joined".`,
      buildJoinKeyboard()
    );
  };
}

function registerJoinCallback(bot) {
  bot.action('check_join', async (ctx) => {
    const joined = await checkAllJoined(ctx.telegram, ctx.from.id);
    if (joined) {
      await ctx.answerCbQuery('✅ Verified! You\'re in.');
      await ctx.editMessageText('✅ Thanks for joining! You can now use all commands. Send /help to get started.');
    } else {
      await ctx.answerCbQuery('❌ Still missing one — make sure you joined both.', { show_alert: true });
    }
  });
}

module.exports = { forceJoinMiddleware, registerJoinCallback, checkAllJoined, buildJoinKeyboard };
