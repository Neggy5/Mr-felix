const config = require('./config');

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

function fmt(n) {
  return Math.floor(n).toLocaleString('en-US');
}

function isOwner(userId) {
  return config.OWNER_IDS.includes(Number(userId));
}

// Percentage generator seeded by user id + command name so results feel
// "sticky" for a given person within the same day, like the check-bot
// commands people expect, instead of pure random spam.
function seededPercent(seedStr) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 101;
}

function displayName(user) {
  if (!user) return 'someone';
  return user.username ? `@${user.username}` : (user.first_name || 'someone');
}

async function requireGroup(ctx) {
  if (ctx.chat.type === 'private') {
    await ctx.reply('This command only works inside a group.');
    return false;
  }
  return true;
}

async function isUserAdmin(ctx, userId) {
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, userId);
    return ['administrator', 'creator'].includes(member.status);
  } catch (e) {
    return false;
  }
}

async function requireAdmin(ctx) {
  if (isOwner(ctx.from.id)) return true;
  const ok = await isUserAdmin(ctx, ctx.from.id);
  if (!ok) await ctx.reply('This command is for group admins only.');
  return ok;
}

// Resolve the target of a moderation command: reply-to-message user,
// or @username / numeric id passed as the first argument.
function getTargetUserId(ctx) {
  if (ctx.message.reply_to_message) {
    return ctx.message.reply_to_message.from.id;
  }
  const arg = ctx.message.text.split(' ')[1];
  if (arg && /^\d+$/.test(arg)) return Number(arg);
  return null;
}

// ---- coloured inline buttons (Bot API 9.4, Feb 9 2026) ----
// Telegraf's Markup.button helpers don't expose the new `style` field yet,
// so these build raw button objects instead. Telegraf passes unknown keys
// straight through in the JSON it sends to Telegram, so this works even on
// older telegraf versions - no library upgrade required.
//
// style values: omit (or null) = default accent/blue · "destructive" = red
// "secondary" = gray/muted. Pair with callback_data or url, not both.
function styledButton(text, callback_data, style) {
  const btn = { text, callback_data };
  if (style) btn.style = style;
  return btn;
}

function styledUrlButton(text, url, style) {
  const btn = { text, url };
  if (style) btn.style = style;
  return btn;
}

module.exports = {
  rand, pick, fmt, isOwner, seededPercent, displayName,
  requireGroup, isUserAdmin, requireAdmin, getTargetUserId,
  styledButton, styledUrlButton
};
