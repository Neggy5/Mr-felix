// Central command registry. Every command module calls registry.add(),
// then index.js registers each one (plus its aliases) as a Telegraf command
// and uses the same list to build /help and /allcmd.

function createRegistry() {
  const commands = [];
  const byName = new Map();

  function add(cmd) {
    if (byName.has(cmd.name)) {
      throw new Error(`Duplicate command name: ${cmd.name}`);
    }
    commands.push(cmd);
    byName.set(cmd.name, cmd);
    for (const alias of cmd.aliases || []) {
      byName.set(alias, cmd);
    }
  }

  function byCategory() {
    const cats = {};
    for (const cmd of commands) {
      if (!cats[cmd.category]) cats[cmd.category] = [];
      cats[cmd.category].push(cmd);
    }
    return cats;
  }

  function all() {
    return commands;
  }

  return { add, byCategory, all, byName };
}

module.exports = { createRegistry };
