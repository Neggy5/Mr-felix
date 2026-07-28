const fetch = require('node-fetch');
const config = require('../config');

const conversations = new Map(); // userId -> [{role, content}]

async function callAI(userId, prompt, systemPrompt) {
  if (!config.AI_API_KEY) {
    return 'AI features need an API key. Set AI_API_KEY (and optionally AI_API_URL / AI_MODEL) in your .env — any OpenAI-compatible chat completions endpoint works.';
  }
  const history = conversations.get(userId) || [];
  const messages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...history,
    { role: 'user', content: prompt }
  ];
  const res = await fetch(config.AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.AI_API_KEY}`
    },
    body: JSON.stringify({ model: config.AI_MODEL, messages, max_tokens: 800 })
  });
  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || 'No response from the AI provider.';
  history.push({ role: 'user', content: prompt }, { role: 'assistant', content: reply });
  conversations.set(userId, history.slice(-20));
  return reply;
}

module.exports = (registry) => {
  // A handful of aliases all point at the same general-purpose chat command,
  // matching the menu's list of different "model name" commands. Swap
  // AI_MODEL per-call here later if you want each alias to hit a different
  // real model.
  const aiAliases = ['ai', 'gpt5', 'copilot', 'copilotthink', 'dolphin', 'dolphincreative', 'dolphinsummary', 'dolphincode', 'deepseek', 'deepseekr', 'storygen'];
  registry.add({
    name: aiAliases[0],
    aliases: aiAliases.slice(1),
    category: 'AI & Tools',
    description: 'Chat with the AI assistant',
    handler: async (ctx) => {
      const prompt = ctx.message.text.split(' ').slice(1).join(' ');
      if (!prompt) return ctx.reply('Usage: /ai your question here');
      await ctx.sendChatAction('typing');
      const reply = await callAI(ctx.from.id, prompt);
      await ctx.reply(reply);
    }
  });

  registry.add({
    name: 'detectbugs',
    category: 'AI & Tools',
    description: 'Paste code after the command to get a bug review',
    handler: async (ctx) => {
      const code = ctx.message.text.split(' ').slice(1).join(' ');
      if (!code) return ctx.reply('Usage: /detectbugs <your code>');
      await ctx.sendChatAction('typing');
      const reply = await callAI(ctx.from.id, code, 'You are a senior code reviewer. Point out real bugs concisely.');
      await ctx.reply(reply);
    }
  });

  registry.add({
    name: 'prompttocode',
    category: 'AI & Tools',
    description: 'Describe what you want, get code back',
    handler: async (ctx) => {
      const prompt = ctx.message.text.split(' ').slice(1).join(' ');
      if (!prompt) return ctx.reply('Usage: /prompttocode a function that reverses a string in Python');
      await ctx.sendChatAction('typing');
      const reply = await callAI(ctx.from.id, prompt, 'Return clean, working code with minimal explanation.');
      await ctx.reply(reply);
    }
  });

  registry.add({
    name: 'convertcode',
    category: 'AI & Tools',
    description: 'Convert code between languages: /convertcode to Python <code>',
    handler: async (ctx) => {
      const prompt = ctx.message.text.split(' ').slice(1).join(' ');
      if (!prompt) return ctx.reply('Usage: /convertcode to Python <code>');
      await ctx.sendChatAction('typing');
      const reply = await callAI(ctx.from.id, prompt, 'You convert code between programming languages accurately.');
      await ctx.reply(reply);
    }
  });

  registry.add({
    name: 'explaincode',
    category: 'AI & Tools',
    description: 'Explain a code snippet',
    handler: async (ctx) => {
      const code = ctx.message.text.split(' ').slice(1).join(' ');
      if (!code) return ctx.reply('Usage: /explaincode <your code>');
      await ctx.sendChatAction('typing');
      const reply = await callAI(ctx.from.id, code, 'Explain this code clearly and concisely for a developer.');
      await ctx.reply(reply);
    }
  });

  registry.add({
    name: 'clearchat',
    category: 'AI & Tools',
    description: 'Clear your AI conversation memory',
    handler: async (ctx) => {
      conversations.delete(ctx.from.id);
      await ctx.reply('🧹 Cleared your AI conversation history.');
    }
  });

  registry.add({
    name: 'ocr',
    category: 'AI & Tools',
    description: 'Reply to a photo to extract text from it',
    handler: async (ctx) => {
      await ctx.reply('OCR needs an image-to-text API (e.g. an OCR.space key or a vision-capable AI model). Tell me which provider you want and I\'ll wire it into this handler.');
    }
  });

  registry.add({
    name: 'lyrics',
    category: 'AI & Tools',
    description: 'Song lyrics lookup',
    handler: async (ctx) => {
      await ctx.reply('I can\'t reproduce song lyrics due to copyright, but I can point you to a licensed lyrics site, or discuss a song\'s themes/meaning if that helps.');
    }
  });

  registry.add({
    name: 'weather',
    category: 'AI & Tools',
    description: 'Weather for a city: /weather London',
    handler: async (ctx) => {
      const city = ctx.message.text.split(' ').slice(1).join(' ');
      if (!city) return ctx.reply('Usage: /weather London');
      if (!config.WEATHER_API_KEY) return ctx.reply('Weather needs a WEATHER_API_KEY (e.g. from OpenWeatherMap) set in .env.');
      try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${config.WEATHER_API_KEY}`);
        const data = await res.json();
        if (data.cod !== 200) return ctx.reply(`Couldn't find weather for "${city}".`);
        await ctx.reply(`🌤️ ${data.name}: ${data.main.temp}°C, ${data.weather[0].description}`);
      } catch (e) {
        await ctx.reply('Weather lookup failed.');
      }
    }
  });

  registry.add({
    name: 'ip',
    category: 'AI & Tools',
    description: 'Basic public info about an IP address: /ip 8.8.8.8',
    handler: async (ctx) => {
      const ip = ctx.message.text.split(' ')[1];
      if (!ip) return ctx.reply('Usage: /ip 8.8.8.8');
      try {
        const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
        const data = await res.json();
        if (data.error) return ctx.reply('Invalid IP or lookup failed.');
        await ctx.reply(`🌐 ${data.ip}\nCity: ${data.city || 'n/a'}\nRegion: ${data.region || 'n/a'}\nCountry: ${data.country_name || 'n/a'}\nISP: ${data.org || 'n/a'}`);
      } catch (e) {
        await ctx.reply('IP lookup failed.');
      }
    }
  });

  registry.add({
    name: 'remind',
    category: 'AI & Tools',
    description: 'Set a reminder: /remind 10m drink water',
    handler: async (ctx) => {
      const parts = ctx.message.text.split(' ');
      const when = parts[1];
      const text = parts.slice(2).join(' ');
      const match = when && when.match(/^(\d+)(m|h)$/);
      if (!match || !text) return ctx.reply('Usage: /remind 10m drink water');
      const ms = match[2] === 'h' ? Number(match[1]) * 3600000 : Number(match[1]) * 60000;
      setTimeout(() => ctx.telegram.sendMessage(ctx.chat.id, `⏰ Reminder for ${ctx.from.first_name}: ${text}`).catch(() => {}), ms);
      await ctx.reply(`✅ I'll remind you in ${when}.`);
    }
  });

  registry.add({
    name: 'readqr',
    category: 'AI & Tools',
    description: 'Reply to a QR code image to decode it',
    handler: async (ctx) => {
      await ctx.reply('QR decoding needs an image-processing library (e.g. jsqr with a canvas). Ask and I\'ll add that dependency and wire this up.');
    }
  });

  registry.add({
    name: 'tweetgen',
    category: 'AI & Tools',
    description: 'Generate a fake tweet screenshot',
    handler: async (ctx) => {
      await ctx.reply('Tweet-image generation needs an HTML/canvas renderer bundled in. Happy to add that as its own module if you want this one built out fully.');
    }
  });

  registry.add({
    name: 'tweetprofiles',
    category: 'AI & Tools',
    description: 'Look up a public Twitter/X profile summary',
    handler: async (ctx) => {
      await ctx.reply('This needs a Twitter/X API key (their API is paid-only now). Add TWITTER_BEARER_TOKEN to .env and I can wire this up.');
    }
  });

  registry.add({
    name: 'ttstalk',
    category: 'AI & Tools',
    description: 'Look up a public TikTok profile summary',
    handler: async (ctx) => {
      const user = ctx.message.text.split(' ')[1];
      if (!user) return ctx.reply('Usage: /ttstalk username');
      await ctx.reply('Public TikTok profile lookups need a scraping API key (e.g. RapidAPI TikTok endpoints). Tell me which provider you have and I\'ll connect it.');
    }
  });

  registry.add({
    name: 'igstalk',
    category: 'AI & Tools',
    description: 'Look up a public Instagram profile summary',
    handler: async (ctx) => {
      const user = ctx.message.text.split(' ')[1];
      if (!user) return ctx.reply('Usage: /igstalk username');
      await ctx.reply('Public Instagram profile lookups need an API key (Instagram\'s own API, or a third-party provider). Tell me which one you have and I\'ll connect it.');
    }
  });
};
