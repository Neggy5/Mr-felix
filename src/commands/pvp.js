const db = require('../db');
const { fmt, rand, getTargetUserId } = require('../utils');

// "Kill & War" here is purely a virtual in-chat economy game (like a mafia
// or werewolf night game) - no real-world weapon or violence content, just
// game state: a target's "health" flag and bragging rights on a leaderboard.

const deadUsers = new Set(); // in-memory "wasted" flags, per process
const protectedUsers = new Set();
const heists = new Map(); // chatId -> { participants: Set, active: bool }
const mafiaGames = new Map(); // chatId -> game state

module.exports = (registry) => {
  registry.add({
    name: 'kill',
    category: 'Kill & War',
    description: 'Virtual "kill" a user in the game (reply to them)',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      if (!targetId || targetId === ctx.from.id) return ctx.reply('Reply to the user you want to "eliminate" in the game.');
      if (protectedUsers.has(targetId)) {
        protectedUsers.delete(targetId);
        return ctx.reply('🛡️ They were protected! Your attempt failed.');
      }
      deadUsers.add(targetId);
      const t = db.getUser(targetId);
      await ctx.reply(`💀 ${t.name} has been "wasted" in the game! Use /revive to bring them back.`);
    }
  });

  registry.add({
    name: 'revive',
    category: 'Kill & War',
    description: 'Revive a "wasted" user',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      if (!targetId) return ctx.reply('Reply to a wasted user to revive them.');
      deadUsers.delete(targetId);
      const t = db.getUser(targetId);
      await ctx.reply(`❤️ ${t.name} has been revived.`);
    }
  });

  registry.add({
    name: 'addprotect',
    category: 'Kill & War',
    description: 'Shield yourself or a replied user from the next /kill',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx) || ctx.from.id;
      protectedUsers.add(targetId);
      await ctx.reply('🛡️ Protection active until the next kill attempt.');
    }
  });

  registry.add({
    name: 'removeprotect',
    category: 'Kill & War',
    description: 'Remove protection from yourself or a replied user',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx) || ctx.from.id;
      protectedUsers.delete(targetId);
      await ctx.reply('🛡️ Protection removed.');
    }
  });

  registry.add({
    name: 'bounty',
    category: 'Kill & War',
    description: 'Put a bounty on a user: reply + /bounty 200',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      const amount = parseInt(ctx.message.text.split(' ').pop(), 10);
      if (!targetId || !amount) return ctx.reply('Reply to a user: /bounty 200');
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      if (u.balance < amount) return ctx.reply('You can\'t afford that bounty.');
      u.balance -= amount;
      const t = db.getUser(targetId);
      t.bountyOn = (t.bountyOn || 0) + amount;
      db.save();
      await ctx.reply(`🎯 $${fmt(amount)} bounty placed on ${t.name}.`);
    }
  });

  registry.add({
    name: 'hitlist',
    category: 'Kill & War',
    description: 'Show users with an active bounty',
    handler: async (ctx) => {
      const withBounty = Object.values(db.allUsers()).filter((u) => u.bountyOn > 0);
      if (!withBounty.length) return ctx.reply('No active bounties.');
      const text = withBounty.map((u) => `• ${u.name} — $${fmt(u.bountyOn)}`).join('\n');
      await ctx.reply(`🎯 *Hit List*\n${text}`, { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'bodycount',
    category: 'Kill & War',
    description: 'How many users are currently "wasted" in this process',
    handler: async (ctx) => ctx.reply(`💀 Current body count: ${deadUsers.size}`)
  });

  registry.add({
    name: 'wasted',
    category: 'Kill & War',
    description: 'Check if a user is currently "wasted"',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx) || ctx.from.id;
      await ctx.reply(deadUsers.has(targetId) ? '💀 They are currently wasted.' : '❤️ They are alive and well.');
    }
  });

  registry.add({
    name: 'wanted',
    category: 'Kill & War',
    description: 'Check if a user has a bounty on them',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx) || ctx.from.id;
      const t = db.getUser(targetId);
      await ctx.reply(t.bountyOn ? `🎯 Wanted for $${fmt(t.bountyOn)}.` : 'No bounty on this user.');
    }
  });

  registry.add({
    name: 'warzones',
    category: 'Kill & War',
    description: 'List active PvP-style sessions in this chat',
    handler: async (ctx) => {
      const heist = heists.get(String(ctx.chat.id));
      const mafia = mafiaGames.get(String(ctx.chat.id));
      await ctx.reply(`⚔️ Active sessions:\nHeist: ${heist?.active ? 'yes' : 'no'}\nMafia: ${mafia ? mafia.phase : 'none'}`);
    }
  });

  registry.add({
    name: 'bloodhound',
    category: 'Kill & War',
    description: 'Track down the top bounty target',
    handler: async (ctx) => {
      const top = Object.values(db.allUsers()).sort((a, b) => (b.bountyOn || 0) - (a.bountyOn || 0))[0];
      if (!top || !top.bountyOn) return ctx.reply('No bounty targets right now.');
      await ctx.reply(`🐺 Top target: ${top.name} — $${fmt(top.bountyOn)} bounty.`);
    }
  });

  registry.add({
    name: 'duel',
    category: 'Kill & War',
    description: 'Challenge a user to a duel for cash: reply + /duel 100',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      const amount = parseInt(ctx.message.text.split(' ').pop(), 10);
      if (!targetId || !amount) return ctx.reply('Reply to a user: /duel 100');
      const u = db.getUser(ctx.from.id, ctx.from.first_name);
      const t = db.getUser(targetId);
      if (u.balance < amount || t.balance < amount) return ctx.reply('Both players need enough balance to cover the stake.');
      const winner = Math.random() < 0.5 ? u : t;
      const loser = winner === u ? t : u;
      winner.balance += amount;
      loser.balance -= amount;
      db.save();
      await ctx.reply(`⚔️ ${winner.name} wins the duel and takes $${fmt(amount)} from ${loser.name}!`);
    }
  });

  registry.add({
    name: 'secbattle',
    category: 'Kill & War',
    description: 'Quick coinflip-style skirmish between two players',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx);
      if (!targetId) return ctx.reply('Reply to a user to battle them.');
      const winnerId = Math.random() < 0.5 ? ctx.from.id : targetId;
      const w = db.getUser(winnerId);
      await ctx.reply(`⚔️ ${w.name} wins the skirmish!`);
    }
  });

  // ---- teams ----
  const teams = new Map(); // chatId -> Map(userId -> teamName)
  registry.add({
    name: 'teamup',
    category: 'Kill & War',
    description: 'Create/join a team: /teamup TeamName',
    handler: async (ctx) => {
      const teamName = ctx.message.text.split(' ').slice(1).join(' ');
      if (!teamName) return ctx.reply('Usage: /teamup TeamName');
      const key = String(ctx.chat.id);
      if (!teams.has(key)) teams.set(key, new Map());
      teams.get(key).set(ctx.from.id, teamName);
      await ctx.reply(`🤝 ${ctx.from.first_name} joined team "${teamName}".`);
    }
  });

  registry.add({
    name: 'teambattle',
    category: 'Kill & War',
    description: 'Battle another team: /teambattle TeamName',
    handler: async (ctx) => {
      const teamName = ctx.message.text.split(' ').slice(1).join(' ');
      if (!teamName) return ctx.reply('Usage: /teambattle EnemyTeamName');
      const winner = Math.random() < 0.5 ? 'Your team' : teamName;
      await ctx.reply(`⚔️ Team battle result: ${winner} wins!`);
    }
  });

  registry.add({
    name: 'myteam',
    category: 'Kill & War',
    description: 'Show your current team',
    handler: async (ctx) => {
      const key = String(ctx.chat.id);
      const team = teams.get(key)?.get(ctx.from.id);
      await ctx.reply(team ? `🤝 Your team: ${team}` : 'You haven\'t joined a team yet. Use /teamup TeamName.');
    }
  });

  registry.add({
    name: 'leaveteam',
    category: 'Kill & War',
    description: 'Leave your current team',
    handler: async (ctx) => {
      const key = String(ctx.chat.id);
      teams.get(key)?.delete(ctx.from.id);
      await ctx.reply('👋 You left your team.');
    }
  });

  // ---- heist ----
  registry.add({
    name: 'heist',
    category: 'Kill & War',
    description: 'Start a group heist: others /joinheist within 60s',
    handler: async (ctx) => {
      const key = String(ctx.chat.id);
      if (heists.get(key)?.active) return ctx.reply('A heist is already running here.');
      const state = { active: true, participants: new Set([ctx.from.id]) };
      heists.set(key, state);
      await ctx.reply(`🏦 ${ctx.from.first_name} started a heist! Others: /joinheist within 60 seconds.`);
      setTimeout(async () => {
        state.active = false;
        const ids = [...state.participants];
        const success = Math.random() < 0.5;
        if (success) {
          const total = rand(500, 2000) * ids.length;
          const share = Math.floor(total / ids.length);
          for (const id of ids) {
            const u = db.getUser(id);
            u.balance += share;
          }
          db.save();
          await ctx.telegram.sendMessage(ctx.chat.id, `🏦 Heist succeeded! Each of the ${ids.length} participant(s) earned $${fmt(share)}.`);
        } else {
          await ctx.telegram.sendMessage(ctx.chat.id, '🚔 The heist was foiled! Everyone walks away empty-handed.');
        }
      }, 60000);
    }
  });

  registry.add({
    name: 'joinheist',
    category: 'Kill & War',
    description: 'Join the current heist',
    handler: async (ctx) => {
      const key = String(ctx.chat.id);
      const state = heists.get(key);
      if (!state?.active) return ctx.reply('No heist is running right now. Start one with /heist.');
      state.participants.add(ctx.from.id);
      await ctx.reply(`✅ ${ctx.from.first_name} joined the heist. (${state.participants.size} total)`);
    }
  });

  // ---- Mafia game (simplified state machine) ----
  registry.add({
    name: 'mafia',
    category: 'Mafia Game',
    description: 'Mafia game: /mafia start <bet> | join | begin | vote | endvote | dawn | kill | save | investigate | status | cancel',
    handler: async (ctx) => {
      const key = String(ctx.chat.id);
      const parts = ctx.message.text.split(' ').slice(1);
      const sub = (parts[0] || '').toLowerCase();
      let game = mafiaGames.get(key);

      if (sub === 'start') {
        if (game) return ctx.reply('A game is already in progress. /mafia cancel to reset.');
        const bet = parseInt(parts[1], 10) || 0;
        game = { phase: 'lobby', bet, players: new Map([[ctx.from.id, ctx.from.first_name]]), votes: {}, roles: {} };
        mafiaGames.set(key, game);
        return ctx.reply(`🎭 Mafia game started (bet: $${fmt(bet)}). Others: /mafia join. Host: /mafia begin when ready.`);
      }
      if (!game) return ctx.reply('No game running. Start one with /mafia start.');

      if (sub === 'join') {
        if (game.phase !== 'lobby') return ctx.reply('Game already started.');
        game.players.set(ctx.from.id, ctx.from.first_name);
        return ctx.reply(`✅ ${ctx.from.first_name} joined. (${game.players.size} players)`);
      }
      if (sub === 'begin') {
        if (game.players.size < 3) return ctx.reply('Need at least 3 players to begin.');
        const ids = [...game.players.keys()];
        const mafiaCount = Math.max(1, Math.floor(ids.length / 4));
        const shuffled = ids.sort(() => Math.random() - 0.5);
        shuffled.forEach((id, i) => { game.roles[id] = i < mafiaCount ? 'mafia' : (i === mafiaCount ? 'detective' : 'villager'); });
        game.phase = 'night';
        for (const id of ids) {
          ctx.telegram.sendMessage(id, `🎭 Your role: ${game.roles[id]}`).catch(() => {});
        }
        return ctx.reply('🌙 Night falls. Roles sent by DM (players must have started the bot privately). Mafia: /mafia kill, Detective: /mafia investigate.');
      }
      if (sub === 'vote') {
        const targetId = getTargetUserId(ctx);
        if (!targetId) return ctx.reply('Reply to a player to vote them out.');
        game.votes[ctx.from.id] = targetId;
        return ctx.reply(`🗳️ Vote recorded.`);
      }
      if (sub === 'endvote') {
        const tally = {};
        for (const t of Object.values(game.votes)) tally[t] = (tally[t] || 0) + 1;
        const [outId] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0] || [];
        if (!outId) return ctx.reply('No votes cast.');
        const name = game.players.get(Number(outId));
        game.players.delete(Number(outId));
        game.votes = {};
        return ctx.reply(`⚖️ ${name} was voted out. Role was: ${game.roles[outId]}`);
      }
      if (sub === 'kill') {
        const targetId = getTargetUserId(ctx);
        if (!targetId) return ctx.reply('Reply to the player to eliminate.');
        game.nightKill = targetId;
        return ctx.reply('🔪 Kill locked in for tonight.');
      }
      if (sub === 'save') {
        game.nightSave = getTargetUserId(ctx);
        return ctx.reply('💉 Save locked in for tonight.');
      }
      if (sub === 'investigate') {
        const targetId = getTargetUserId(ctx);
        if (!targetId) return ctx.reply('Reply to the player to investigate.');
        return ctx.reply(`🔍 Result: ${game.roles[targetId] === 'mafia' ? 'Suspicious!' : 'Clean.'}`, { reply_to_message_id: undefined });
      }
      if (sub === 'dawn') {
        if (game.nightKill && game.nightKill !== game.nightSave) {
          const name = game.players.get(game.nightKill);
          game.players.delete(game.nightKill);
          await ctx.reply(`☀️ Dawn breaks. ${name} was found dead.`);
        } else {
          await ctx.reply('☀️ Dawn breaks. Everyone survived the night!');
        }
        game.nightKill = null;
        game.nightSave = null;
        game.phase = 'day';
        return;
      }
      if (sub === 'status') {
        const alive = [...game.players.values()].join(', ');
        return ctx.reply(`🎭 Phase: ${game.phase}\nAlive: ${alive}`);
      }
      if (sub === 'cancel') {
        mafiaGames.delete(key);
        return ctx.reply('🛑 Mafia game cancelled.');
      }
      await ctx.reply('Unknown subcommand. See /mafia for usage.');
    }
  });
};
