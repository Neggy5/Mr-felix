const db = require('../db');
const { fmt, rand, getTargetUserId } = require('../utils');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const SHOP_ITEMS = [
  { id: 'shield', name: '🛡️ Shield', price: 500, desc: 'Blocks the next /rob against you' },
  { id: 'lockpick', name: '🗝️ Lockpick', price: 300, desc: 'Improves /crime success odds' },
  { id: 'ring', name: '💍 Wedding Ring', price: 1000, desc: 'Required for /marry' },
  { id: 'trophy', name: '🏆 Trophy', price: 2000, desc: 'Just for flexing on /profile' }
];

function cooldownLeft(last, ms) {
  const rem = last + ms - Date.now();
  return rem > 0 ? rem : 0;
}

function fmtTime(ms) {
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

module.exports = (registry) => {
  registry.add({
    name: 'balance',
    aliases: ['wallet'],
    category: 'Economy',
    description: 'Check your wallet and bank balance',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      await ctx.reply(`💰 Wallet: $${fmt(u.balance)}\n🏦 Bank: $${fmt(u.bank)}`);
    }
  });

  registry.add({
    name: 'daily',
    aliases: ['income'],
    category: 'Economy',
    description: 'Claim your daily reward',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      const left = cooldownLeft(u.lastDaily, DAY);
      if (left > 0) return ctx.reply(`⏳ Come back in ${fmtTime(left)} for your next daily.`);
      const streakBonus = Math.min(u.dailyStreak, 10) * 50;
      const reward = 500 + streakBonus;
      u.balance += reward;
      u.lastDaily = Date.now();
      u.dailyStreak += 1;
      db.save();
      await ctx.reply(`🎁 Daily claimed! +$${fmt(reward)} (streak: ${u.dailyStreak})`);
    }
  });

  registry.add({
    name: 'streak',
    category: 'Economy',
    description: 'Check your daily claim streak',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      await ctx.reply(`🔥 Current daily streak: ${u.dailyStreak}`);
    }
  });

  registry.add({
    name: 'work',
    aliases: ['payday'],
    category: 'Economy',
    description: 'Work a shift for cash',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      const left = cooldownLeft(u.lastWork, HOUR);
      if (left > 0) return ctx.reply(`⏳ You're tired. Rest ${fmtTime(left)} before your next shift.`);
      const earned = rand(100, 400);
      u.balance += earned;
      u.lastWork = Date.now();
      db.save();
      await ctx.reply(`💼 You worked a shift and earned $${fmt(earned)}.`);
    }
  });

  registry.add({
    name: 'hustle',
    category: 'Economy',
    description: 'Quick side hustle, smaller reward but no cooldown penalty',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      const earned = rand(20, 90);
      u.balance += earned;
      db.save();
      await ctx.reply(`🛺 Side hustle paid $${fmt(earned)}.`);
    }
  });

  registry.add({
    name: 'crime',
    category: 'Economy',
    description: 'Attempt a crime for a bigger payout, risk of a fine',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      const left = cooldownLeft(u.lastCrime, HOUR);
      if (left > 0) return ctx.reply(`⏳ Lay low for ${fmtTime(left)} before your next job.`);
      u.lastCrime = Date.now();
      const hasLockpick = u.inventory.includes('lockpick');
      const successRate = hasLockpick ? 0.65 : 0.5;
      if (Math.random() < successRate) {
        const earned = rand(200, 800);
        u.balance += earned;
        db.save();
        await ctx.reply(`🕵️ The job paid off! +$${fmt(earned)}`);
      } else {
        const fine = rand(100, 300);
        u.balance = Math.max(0, u.balance - fine);
        db.save();
        await ctx.reply(`🚔 Busted! You paid a $${fmt(fine)} fine.`);
      }
    }
  });

  registry.add({
    name: 'rob',
    category: 'Economy',
    description: 'Try to rob another user (reply to them)',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      if (!targetId || targetId === ctx.from.id) return ctx.reply('Reply to someone else\'s message to rob them.');
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      const t = db.getUser(targetId);
      const left = cooldownLeft(u.lastRob, HOUR);
      if (left > 0) return ctx.reply(`⏳ Lay low for ${fmtTime(left)} before robbing again.`);
      u.lastRob = Date.now();
      if (t.inventory.includes('shield')) {
        t.inventory = t.inventory.filter((i) => i !== 'shield');
        db.save();
        return ctx.reply('🛡️ Their shield blocked the robbery!');
      }
      if (t.balance < 50) return ctx.reply('They\'re too broke to rob.');
      if (Math.random() < 0.45) {
        const stolen = Math.floor(t.balance * (0.1 + Math.random() * 0.2));
        t.balance -= stolen;
        u.balance += stolen;
        db.save();
        await ctx.reply(`💸 You robbed $${fmt(stolen)}!`);
      } else {
        const fine = rand(50, 200);
        u.balance = Math.max(0, u.balance - fine);
        db.save();
        await ctx.reply(`🚨 Caught in the act! You paid $${fmt(fine)}.`);
      }
    }
  });

  registry.add({
    name: 'loan',
    category: 'Economy',
    description: 'Take out a loan: /loan 1000',
    handler: async (ctx) => {
      const amount = parseInt(ctx.message.text.split(' ')[1], 10);
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (!amount || amount <= 0) return ctx.reply('Usage: /loan 1000');
      if (u.loan > 0) return ctx.reply('Pay off your existing loan first with /repayloan.');
      if (amount > 5000) return ctx.reply('Max loan amount is $5000.');
      u.loan = Math.floor(amount * 1.1); // 10% interest
      u.balance += amount;
      db.save();
      await ctx.reply(`🏦 Loan approved: +$${fmt(amount)}. You owe $${fmt(u.loan)} (10% interest).`);
    }
  });

  registry.add({
    name: 'repayloan',
    category: 'Economy',
    description: 'Repay your loan: /repayloan 500',
    handler: async (ctx) => {
      const amount = parseInt(ctx.message.text.split(' ')[1], 10);
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (u.loan <= 0) return ctx.reply('You have no outstanding loan.');
      if (!amount || amount <= 0) return ctx.reply('Usage: /repayloan 500');
      const pay = Math.min(amount, u.loan, u.balance);
      u.loan -= pay;
      u.balance -= pay;
      db.save();
      await ctx.reply(`✅ Repaid $${fmt(pay)}. Remaining loan: $${fmt(u.loan)}.`);
    }
  });

  registry.add({
    name: 'myloan',
    category: 'Economy',
    description: 'Check your loan balance',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      await ctx.reply(u.loan > 0 ? `🏦 You owe $${fmt(u.loan)}.` : '✅ No outstanding loans.');
    }
  });

  registry.add({
    name: 'deposit',
    category: 'Economy',
    description: 'Move money from wallet to bank: /deposit 500',
    handler: async (ctx) => {
      const amount = parseInt(ctx.message.text.split(' ')[1], 10);
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (!amount || amount <= 0 || amount > u.balance) return ctx.reply('Usage: /deposit 500 (must not exceed your wallet balance)');
      u.balance -= amount;
      u.bank += amount;
      db.save();
      await ctx.reply(`🏦 Deposited $${fmt(amount)}.`);
    }
  });

  registry.add({
    name: 'withdraw',
    category: 'Economy',
    description: 'Move money from bank to wallet: /withdraw 500',
    handler: async (ctx) => {
      const amount = parseInt(ctx.message.text.split(' ')[1], 10);
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (!amount || amount <= 0 || amount > u.bank) return ctx.reply('Usage: /withdraw 500 (must not exceed your bank balance)');
      u.bank -= amount;
      u.balance += amount;
      db.save();
      await ctx.reply(`💰 Withdrew $${fmt(amount)}.`);
    }
  });

  registry.add({
    name: 'give',
    aliases: ['donate'],
    category: 'Economy',
    description: 'Give money to another user: reply + /give 100',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      const amount = parseInt(ctx.message.text.split(' ').pop(), 10);
      if (!targetId || targetId === ctx.from.id) return ctx.reply('Reply to the user you want to give money to.');
      if (!amount || amount <= 0) return ctx.reply('Usage: reply to a user with /give 100');
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (u.balance < amount) return ctx.reply('You don\'t have enough.');
      const t = db.getUser(targetId);
      u.balance -= amount;
      t.balance += amount;
      db.save();
      await ctx.reply(`✅ Gave $${fmt(amount)} to ${t.name}.`);
    }
  });

  registry.add({
    name: 'shop',
    aliases: ['market'],
    category: 'Economy',
    description: 'View items available to buy',
    handler: async (ctx) => {
      const text = SHOP_ITEMS.map((i) => `${i.name} — $${fmt(i.price)}\n  ${i.desc}\n  buy with: /sell ${i.id} (or ask an admin to wire /buy)`).join('\n\n');
      await ctx.reply(`🛒 *Shop*\n\n${text}`, { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'inventory',
    category: 'Economy',
    description: 'See what items you own',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      await ctx.reply(u.inventory.length ? `🎒 ${u.inventory.join(', ')}` : '🎒 Your inventory is empty.');
    }
  });

  registry.add({
    name: 'sell',
    category: 'Economy',
    description: 'Buy an item from the shop by id, e.g. /sell shield (yes, "sell" doubles as buy here to match the original menu)',
    handler: async (ctx) => {
      const id = ctx.message.text.split(' ')[1];
      const item = SHOP_ITEMS.find((i) => i.id === id);
      if (!item) return ctx.reply('Unknown item. Check /shop for valid ids.');
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (u.balance < item.price) return ctx.reply('You can\'t afford that.');
      u.balance -= item.price;
      u.inventory.push(item.id);
      db.save();
      await ctx.reply(`✅ Bought ${item.name}.`);
    }
  });

  registry.add({
    name: 'auction',
    category: 'Economy',
    description: 'List an item for other users to bid on (simple relay)',
    handler: async (ctx) => {
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!text) return ctx.reply('Usage: /auction item name, starting price');
      await ctx.reply(`🔨 Auction started by ${ctx.from.first_name}: ${text}\nReply here with bids!`);
    }
  });

  registry.add({
    name: 'blackmarket',
    category: 'Economy',
    description: 'Flavor-text rare item shop (cosmetic only)',
    handler: async (ctx) => {
      await ctx.reply('🕶️ The black market is empty today. Check back after a /heist.');
    }
  });

  registry.add({
    name: 'leaderboard',
    aliases: ['xplb'],
    category: 'Economy',
    description: 'Top 10 richest users globally',
    handler: async (ctx) => {
      const users = Object.values(db.allUsers())
        .sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank))
        .slice(0, 10);
      const text = users.map((u, i) => `${i + 1}. ${u.name} — $${fmt(u.balance + u.bank)}`).join('\n');
      await ctx.reply(`🏆 *Leaderboard*\n${text || 'No data yet.'}`, { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'groupleaderboard',
    category: 'Economy',
    description: 'Top users in this group (best effort, needs member cache)',
    handler: async (ctx) => {
      await ctx.reply('Group-scoped leaderboards need a per-chat member list. For now use /leaderboard for the global ranking - ask me to scope this to groups in the next batch.');
    }
  });

  registry.add({
    name: 'transactions',
    category: 'Economy',
    description: 'Recent transaction history (stub - wire a ledger to enable)',
    handler: async (ctx) => {
      await ctx.reply('Transaction logging isn\'t enabled yet. I can add a ledger array to each user record if you want full history here.');
    }
  });

  registry.add({
    name: 'networth',
    category: 'Economy',
    description: 'See your total net worth',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      await ctx.reply(`📈 Net worth: $${fmt(u.balance + u.bank - u.loan)} (wallet + bank - loan)`);
    }
  });

  registry.add({
    name: 'richme',
    category: 'Economy',
    description: 'Flex your balance with a random flavor line',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      const lines = ['stacking bricks 🧱', 'never checking the group chat again 💅', 'buying the whole shop 🛍️'];
      await ctx.reply(`💰 ${ctx.from.first_name} is sitting on $${fmt(u.balance + u.bank)} — ${lines[rand(0, lines.length - 1)]}`);
    }
  });

  registry.add({
    name: 'profile',
    category: 'Economy',
    description: 'Full profile card',
    handler: async (ctx) => {
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      await ctx.reply(
        `👤 *${u.name}'s Profile*\n` +
        `💰 Wallet: $${fmt(u.balance)}\n` +
        `🏦 Bank: $${fmt(u.bank)}\n` +
        `🏆 Level: ${u.level} (${u.xp} XP)\n` +
        `🎒 Items: ${u.inventory.length}\n` +
        `💍 Married: ${u.marriedTo ? 'yes' : 'no'}\n` +
        `⚠️ Warns: ${u.warns}`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  registry.add({
    name: 'spy',
    category: 'Economy',
    description: 'Peek at another user\'s public balance',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      if (!targetId) return ctx.reply('Reply to a user to spy on their balance.');
      const t = db.getUser(targetId);
      await ctx.reply(`🕵️ ${t.name} has $${fmt(t.balance)} in their wallet.`);
    }
  });
};
