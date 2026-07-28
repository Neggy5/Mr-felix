// ─────────────────────────────────────────────────────────────
// All settings are hardcoded here instead of using a .env file.
// Edit the values below directly, then redeploy.
// ─────────────────────────────────────────────────────────────

module.exports = {
  // Get this from @BotFather on Telegram.
  BOT_TOKEN: '8837997340:AAFotvN_C0AqVzHdMzrtyWDhTbGhbWolaGw',

  // Your numeric Telegram user ID(s). Get yours from @userinfobot.
  // Owners can use owner-only commands and receive /feedback and /report messages.
  OWNER_IDS: [8361355527],

  BOT_NAME: 'Mr Felix',

  // Shown as the banner image on /start. Can be a direct https:// URL to a
  // .jpg/.png, or a local file path like './assets/banner.jpg' (relative to
  // the project root) if you'd rather ship the image with your repo.
  BOT_IMAGE: 'https://files.catbox.moe/zsv1fs.jpg',

  // Railway assigns this automatically at runtime; this is only a local fallback.
  PORT: process.env.PORT || 3000,

  // ---- Force-join gate ----
  // Users must join these before they can use any command.
  // For public channels/groups, the "id" can just be the @username.
  // For private ones, use the numeric chat ID (starts with -100...) and
  // make sure the bot is an ADMIN of that chat, or membership checks will fail.
  FORCE_JOIN: {
    enabled: true,
    channel: {
      id: '@zukoxmd1',       // used for the membership check
      url: 'https://t.me/zukoxmd1', // used for the join button
      label: '📢 Join Channel'
    },
    group: {
      id: '@zukoxmd',
      url: 'https://t.me/zukoxmd',
      label: '💬 Join Group'
    }
  },

  // ---- Optional integrations ----
  // Leave blank to keep the related commands running in "explain what's
  // missing" mode. Fill in to make them fully live.
  AI_API_KEY: '',
  AI_API_URL: 'https://api.openai.com/v1/chat/completions',
  AI_MODEL: 'gpt-4o-mini',
  WEATHER_API_KEY: ''
};
