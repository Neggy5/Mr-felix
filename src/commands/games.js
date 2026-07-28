const db = require('../db');
const { fmt, rand, pick } = require('../utils');

const JOKES = [
  "I told my computer I needed a break, and it said no problem — it froze immediately.",
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "I would tell you a UDP joke, but you might not get it.",
  "There are 10 kinds of people: those who understand binary and those who don't."
];

const QUOTES = [
  "The best way to predict the future is to create it.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "Do or do not, there is no try."
];

const EIGHTBALL = ['Yes.', 'No.', 'Definitely.', 'Ask again later.', 'Very doubtful.', 'Absolutely!', 'It is uncertain.'];
const WYR = [
  'Would you rather have unlimited pizza or unlimited tacos for life?',
  'Would you rather be able to fly or be invisible?',
  'Would you rather lose all your money or all your photos?'
];
const TRUTHS = ['What is your biggest fear?', "What's a secret you've never told anyone here?", 'What is the most embarrassing thing you\'ve done?'];
const DARES = ['Send a voice message singing your favorite song.', 'Change your name to something silly for 10 minutes.', 'Text your crush "hi" right now.'];

const TRIVIA = [
  { q: 'What is the capital of France?', a: 'paris' },
  { q: 'How many continents are there?', a: '7' },
  { q: 'What planet is known as the Red Planet?', a: 'mars' }
];

module.exports = (registry) => {
  registry.add({
    name: 'coinflip',
    aliases: ['flip', 'gamble'],
    category: 'Games',
    description: 'Flip a coin, optionally bet: /coinflip 100 heads',
    handler: async (ctx) => {
      const parts = ctx.message.text.split(' ');
      const amount = parseInt(parts[1], 10);
      const call = (parts[2] || '').toLowerCase();
      const result = pick(['heads', 'tails']);
      if (!amount || !['heads', 'tails'].includes(call)) {
        return ctx.reply(`🪙 It landed on **${result}**! (add a bet like /coinflip 100 heads to gamble)`, { parse_mode: 'Markdown' });
      }
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (amount > u.balance) return ctx.reply('You don\'t have that much.');
      if (result === call) {
        u.balance += amount;
        db.save();
        await ctx.reply(`🪙 Landed on **${result}**! You won $${fmt(amount)}.`, { parse_mode: 'Markdown' });
      } else {
        u.balance -= amount;
        db.save();
        await ctx.reply(`🪙 Landed on **${result}**. You lost $${fmt(amount)}.`, { parse_mode: 'Markdown' });
      }
    }
  });

  registry.add({
    name: 'slots',
    category: 'Games',
    description: 'Slot machine: /slots 100',
    handler: async (ctx) => {
      const amount = parseInt(ctx.message.text.split(' ')[1], 10) || 0;
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (amount <= 0 || amount > u.balance) return ctx.reply('Usage: /slots 100 (must not exceed your balance)');
      const symbols = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
      const roll = [pick(symbols), pick(symbols), pick(symbols)];
      const win = roll[0] === roll[1] && roll[1] === roll[2];
      if (win) {
        const payout = amount * 5;
        u.balance += payout;
        db.save();
        await ctx.reply(`🎰 ${roll.join(' ')}\nJACKPOT! You won $${fmt(payout)}.`);
      } else {
        u.balance -= amount;
        db.save();
        await ctx.reply(`🎰 ${roll.join(' ')}\nNo match. You lost $${fmt(amount)}.`);
      }
    }
  });

  registry.add({
    name: 'roll',
    category: 'Games',
    description: 'Roll a dice, default 1-6',
    handler: async (ctx) => {
      const sides = parseInt(ctx.message.text.split(' ')[1], 10) || 6;
      await ctx.reply(`🎲 You rolled a ${rand(1, sides)} (out of ${sides}).`);
    }
  });

  registry.add({
    name: 'numguess',
    category: 'Games',
    description: 'Guess a number 1-100: /numguess 50',
    handler: async (ctx) => {
      const guess = parseInt(ctx.message.text.split(' ')[1], 10);
      if (!guess) return ctx.reply('Usage: /numguess 50');
      const answer = rand(1, 100);
      if (guess === answer) return ctx.reply('🎯 Exact match! Incredible.');
      await ctx.reply(`The number was ${answer}. ${guess < answer ? 'Too low!' : 'Too high!'}`);
    }
  });

  registry.add({
    name: 'trivia',
    category: 'Games',
    description: 'Answer a trivia question',
    handler: async (ctx) => {
      const t = pick(TRIVIA);
      await ctx.reply(`🧠 ${t.q}\n(reply within this chat with your answer - scoring isn't wired to replies yet, but the question bank is ready to expand)`);
    }
  });

  registry.add({
    name: 'joke',
    category: 'Games',
    description: 'Random joke',
    handler: async (ctx) => ctx.reply(`😂 ${pick(JOKES)}`)
  });

  registry.add({
    name: 'quote',
    category: 'Games',
    description: 'Random inspirational quote',
    handler: async (ctx) => ctx.reply(`💬 "${pick(QUOTES)}"`)
  });

  registry.add({
    name: '8ball',
    category: 'Games',
    description: 'Ask the magic 8-ball a question',
    handler: async (ctx) => ctx.reply(`🎱 ${pick(EIGHTBALL)}`)
  });

  registry.add({
    name: 'wyr',
    category: 'Games',
    description: 'Would you rather...',
    handler: async (ctx) => ctx.reply(`🤔 ${pick(WYR)}`)
  });

  registry.add({
    name: 'truth',
    category: 'Games',
    description: 'Truth question',
    handler: async (ctx) => ctx.reply(`🗣️ Truth: ${pick(TRUTHS)}`)
  });

  registry.add({
    name: 'dare',
    category: 'Games',
    description: 'Dare challenge',
    handler: async (ctx) => ctx.reply(`🔥 Dare: ${pick(DARES)}`)
  });

  registry.add({
    name: 'tod',
    category: 'Games',
    description: 'Random truth or dare',
    handler: async (ctx) => {
      if (Math.random() < 0.5) await ctx.reply(`🗣️ Truth: ${pick(TRUTHS)}`);
      else await ctx.reply(`🔥 Dare: ${pick(DARES)}`);
    }
  });

  registry.add({
    name: 'choose',
    category: 'Games',
    description: 'Pick between options: /choose pizza, tacos, sushi',
    handler: async (ctx) => {
      const options = ctx.message.text.split(' ').slice(1).join(' ').split(',').map((s) => s.trim()).filter(Boolean);
      if (options.length < 2) return ctx.reply('Usage: /choose option1, option2, option3');
      await ctx.reply(`👉 I choose: ${pick(options)}`);
    }
  });

  registry.add({
    name: 'lovecalc',
    category: 'Games',
    description: 'Love calculator between two names: /lovecalc Alice Bob',
    handler: async (ctx) => {
      const [a, b] = ctx.message.text.split(' ').slice(1);
      if (!a || !b) return ctx.reply('Usage: /lovecalc Alice Bob');
      const pct = rand(1, 100);
      await ctx.reply(`💘 ${a} + ${b} = ${pct}% compatible`);
    }
  });

  registry.add({
    name: 'rate',
    category: 'Games',
    description: 'Rate anything out of 10: /rate pineapple pizza',
    handler: async (ctx) => {
      const thing = ctx.message.text.split(' ').slice(1).join(' ');
      if (!thing) return ctx.reply('Usage: /rate pineapple pizza');
      await ctx.reply(`⭐ I'd rate "${thing}" a ${rand(1, 10)}/10.`);
    }
  });

  registry.add({
    name: 'horoscope',
    category: 'Games',
    description: 'Daily horoscope: /horoscope leo',
    handler: async (ctx) => {
      const sign = ctx.message.text.split(' ')[1];
      if (!sign) return ctx.reply('Usage: /horoscope leo');
      const lines = ['Big things are coming your way.', 'Stay cautious with money today.', 'A friend needs your advice.', 'Focus on rest this week.'];
      await ctx.reply(`🔮 ${sign.charAt(0).toUpperCase() + sign.slice(1)}: ${pick(lines)}`);
    }
  });

  registry.add({
    name: 'confession',
    category: 'Games',
    description: 'Post an anonymous confession to the group',
    handler: async (ctx) => {
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!text) return ctx.reply('Usage: /confession your anonymous message');
      try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
      await ctx.reply(`🤫 *Anonymous Confession*\n${text}`, { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'rapbattle',
    category: 'Games',
    description: 'Generate a playful rap battle line vs a replied user',
    handler: async (ctx) => {
      const target = ctx.message.reply_to_message ? ctx.message.reply_to_message.from.first_name : 'you';
      const lines = [
        `${ctx.from.first_name} steps up, ${target} better run,\nspitting bars so hot they outshine the sun!`,
        `${target} thought they had bars, what a shame,\n${ctx.from.first_name} just ended their whole game!`
      ];
      await ctx.reply(`🎤 ${pick(lines)}`);
    }
  });

  registry.add({
    name: 'roastbattle',
    category: 'Games',
    description: 'Lighthearted roast (reply to a friend, keep it playful)',
    handler: async (ctx) => {
      const target = ctx.message.reply_to_message ? ctx.message.reply_to_message.from.first_name : ctx.from.first_name;
      const roasts = [
        `${target}, you're like a cloud — when you disappear, it's a beautiful day.`,
        `${target} brings everyone so much joy... when they leave the room.`,
        `${target}'s WiFi signal has more bars than their pickup lines.`
      ];
      await ctx.reply(`🔥 ${pick(roasts)}`);
    }
  });

  registry.add({
    name: 'stopgame',
    category: 'Games',
    description: 'Cancel any running game session in this chat',
    handler: async (ctx) => ctx.reply('🛑 No trackable session state for that game type yet, but this command is wired and ready for session-based games as they get added.')
  });

  registry.add({
    name: 'blackjack',
    aliases: ['hit', 'stand'],
    category: 'Games',
    description: 'Simple blackjack: /blackjack 100 to start a hand',
    handler: async (ctx) => {
      const amount = parseInt(ctx.message.text.split(' ')[1], 10);
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (!amount || amount <= 0 || amount > u.balance) return ctx.reply('Usage: /blackjack 100');
      const draw = () => rand(1, 11);
      const player = draw() + draw();
      const dealer = draw() + draw();
      let result;
      if (player > 21) result = 'bust';
      else if (dealer > 21 || player > dealer) result = 'win';
      else if (player === dealer) result = 'push';
      else result = 'lose';
      if (result === 'win') { u.balance += amount; }
      else if (result === 'lose' || result === 'bust') { u.balance -= amount; }
      db.save();
      await ctx.reply(`🃏 Your hand: ${player} | Dealer: ${dealer}\nResult: ${result.toUpperCase()}`);
    }
  });
};
