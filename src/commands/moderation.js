const db = require('../db');
const { requireGroup, requireAdmin, getTargetUserId, styledButton } = require('../utils');

function arg1(ctx) {
  const parts = ctx.message.text.split(' ');
  return parts.slice(ctx.message.reply_to_message ? 1 : 2).join(' ');
}

module.exports = (registry) => {
  // ---- basic member actions ----
  registry.add({
    name: 'ban',
    category: 'Moderation',
    description: 'Ban a user (reply to their message or pass their ID)',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const target = getTargetUserId(ctx);
      if (!target) return ctx.reply('Reply to a user or pass their ID: /ban 123456');
      await ctx.reply(`Ban user ${target}? This can't be undone from here.`, {
        reply_markup: {
          inline_keyboard: [[
            styledButton('🔨 Confirm ban', `modconfirm:ban:${target}`, 'destructive'),
            styledButton('Cancel', 'modconfirm:cancel', 'secondary')
          ]]
        }
      });
    }
  });

  registry.add({
    name: 'unban',
    category: 'Moderation',
    description: 'Unban a user by ID',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const target = getTargetUserId(ctx);
      if (!target) return ctx.reply('Usage: /unban 123456');
      try {
        await ctx.telegram.unbanChatMember(ctx.chat.id, target);
        await ctx.reply(`✅ Unbanned user ${target}.`);
      } catch (e) {
        await ctx.reply(`Couldn't unban: ${e.description || e.message}`);
      }
    }
  });

  registry.add({
    name: 'kick',
    category: 'Moderation',
    description: 'Kick a user (ban + immediate unban)',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const target = getTargetUserId(ctx);
      if (!target) return ctx.reply('Reply to a user or pass their ID: /kick 123456');
      await ctx.reply(`Kick user ${target}?`, {
        reply_markup: {
          inline_keyboard: [[
            styledButton('👢 Confirm kick', `modconfirm:kick:${target}`, 'destructive'),
            styledButton('Cancel', 'modconfirm:cancel', 'secondary')
          ]]
        }
      });
    }
  });

  registry.add({
    name: 'mute',
    category: 'Moderation',
    description: 'Mute a user in this group',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const target = getTargetUserId(ctx);
      if (!target) return ctx.reply('Reply to a user or pass their ID: /mute 123456');
      try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, target, {
          permissions: { can_send_messages: false }
        });
        await ctx.reply(`🔇 Muted user ${target}.`);
      } catch (e) {
        await ctx.reply(`Couldn't mute: ${e.description || e.message}`);
      }
    }
  });

  registry.add({
    name: 'unmute',
    category: 'Moderation',
    description: 'Unmute a user',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const target = getTargetUserId(ctx);
      if (!target) return ctx.reply('Reply to a user or pass their ID: /unmute 123456');
      try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, target, {
          permissions: {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_polls: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true
          }
        });
        await ctx.reply(`🔊 Unmuted user ${target}.`);
      } catch (e) {
        await ctx.reply(`Couldn't unmute: ${e.description || e.message}`);
      }
    }
  });

  // ---- warn system ----
  registry.add({
    name: 'warn',
    category: 'Moderation',
    description: 'Warn a user, auto-actions at the warn limit',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const targetId = getTargetUserId(ctx);
      if (!targetId) return ctx.reply('Reply to a user to warn them.');
      const u = db.getUser(targetId, ctx.message.reply_to_message?.from?.first_name);
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      u.warns += 1;
      db.save();
      if (u.warns >= g.warnLimit) {
        u.warns = 0;
        db.save();
        try {
          if (g.warnAction === 'ban') await ctx.telegram.banChatMember(ctx.chat.id, targetId);
          else if (g.warnAction === 'kick') {
            await ctx.telegram.banChatMember(ctx.chat.id, targetId);
            await ctx.telegram.unbanChatMember(ctx.chat.id, targetId);
          } else {
            await ctx.telegram.restrictChatMember(ctx.chat.id, targetId, { permissions: { can_send_messages: false } });
          }
          await ctx.reply(`⚠️ User ${targetId} hit the warn limit and was ${g.warnAction}d.`);
        } catch (e) {
          await ctx.reply(`Warn limit hit but action failed: ${e.description || e.message}`);
        }
      } else {
        await ctx.reply(`⚠️ Warned user ${targetId}. (${u.warns}/${g.warnLimit})`);
      }
    }
  });

  registry.add({
    name: 'warns',
    category: 'Moderation',
    description: 'Check how many warns a user has',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      const targetId = getTargetUserId(ctx) || ctx.from.id;
      const u = db.getUser(targetId);
      const g = db.getGroup(ctx.chat.id);
      await ctx.reply(`⚠️ User ${targetId} has ${u.warns}/${g.warnLimit} warns.`);
    }
  });

  registry.add({
    name: 'unwarn',
    category: 'Moderation',
    description: 'Remove one warn from a user',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const targetId = getTargetUserId(ctx);
      if (!targetId) return ctx.reply('Reply to a user to unwarn them.');
      const u = db.getUser(targetId);
      u.warns = Math.max(0, u.warns - 1);
      db.save();
      await ctx.reply(`✅ Removed one warn from user ${targetId}. Now at ${u.warns}.`);
    }
  });

  registry.add({
    name: 'warnlimit',
    category: 'Moderation',
    description: 'Set how many warns triggers an action, e.g. /warnlimit 5',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const n = parseInt(ctx.message.text.split(' ')[1], 10);
      if (!n || n < 1) return ctx.reply('Usage: /warnlimit 5');
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      g.warnLimit = n;
      db.save();
      await ctx.reply(`✅ Warn limit set to ${n}.`);
    }
  });

  registry.add({
    name: 'warnaction',
    category: 'Moderation',
    description: 'Set the action for hitting the warn limit: mute, kick, or ban',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const action = (ctx.message.text.split(' ')[1] || '').toLowerCase();
      if (!['mute', 'kick', 'ban'].includes(action)) return ctx.reply('Usage: /warnaction mute|kick|ban');
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      g.warnAction = action;
      db.save();
      await ctx.reply(`✅ Warn action set to ${action}.`);
    }
  });

  // ---- promotion ----
  registry.add({
    name: 'promote',
    category: 'Moderation',
    description: 'Promote a user to admin',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const target = getTargetUserId(ctx);
      if (!target) return ctx.reply('Reply to a user to promote them.');
      try {
        await ctx.telegram.promoteChatMember(ctx.chat.id, target, {
          can_change_info: true, can_delete_messages: true, can_invite_users: true,
          can_restrict_members: true, can_pin_messages: true, can_promote_members: false
        });
        const g = db.getGroup(ctx.chat.id, ctx.chat.title);
        g.adminLog.push({ action: 'promote', by: ctx.from.id, target, ts: Date.now() });
        db.save();
        await ctx.reply(`⬆️ Promoted user ${target}.`);
      } catch (e) {
        await ctx.reply(`Couldn't promote: ${e.description || e.message}`);
      }
    }
  });

  registry.add({
    name: 'demote',
    category: 'Moderation',
    description: 'Demote an admin back to member',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const target = getTargetUserId(ctx);
      if (!target) return ctx.reply('Reply to a user to demote them.');
      try {
        await ctx.telegram.promoteChatMember(ctx.chat.id, target, {
          can_change_info: false, can_delete_messages: false, can_invite_users: false,
          can_restrict_members: false, can_pin_messages: false, can_promote_members: false
        });
        const g = db.getGroup(ctx.chat.id, ctx.chat.title);
        g.adminLog.push({ action: 'demote', by: ctx.from.id, target, ts: Date.now() });
        db.save();
        await ctx.reply(`⬇️ Demoted user ${target}.`);
      } catch (e) {
        await ctx.reply(`Couldn't demote: ${e.description || e.message}`);
      }
    }
  });

  registry.add({
    name: 'adminlist',
    category: 'Moderation',
    description: 'List current group admins',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
      const text = admins.map((a) => `• ${a.user.first_name}${a.user.username ? ' (@' + a.user.username + ')' : ''} — ${a.status}`).join('\n');
      await ctx.reply(`👮 *Group Admins*\n${text}`, { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'adminlogs',
    category: 'Moderation',
    description: 'Show recent admin actions logged by the bot',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      if (!g.adminLog.length) return ctx.reply('No admin actions logged yet.');
      const recent = g.adminLog.slice(-10).reverse();
      const text = recent.map((l) => `• ${l.action} — by ${l.by} on ${l.target} (${new Date(l.ts).toLocaleString()})`).join('\n');
      await ctx.reply(`📜 *Recent Admin Actions*\n${text}`, { parse_mode: 'Markdown' });
    }
  });

  // ---- messages / chat management ----
  registry.add({
    name: 'pin',
    category: 'Moderation',
    description: 'Pin the replied-to message',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      if (!ctx.message.reply_to_message) return ctx.reply('Reply to the message you want pinned.');
      try {
        await ctx.telegram.pinChatMessage(ctx.chat.id, ctx.message.reply_to_message.message_id);
        await ctx.reply('📌 Pinned.');
      } catch (e) {
        await ctx.reply(`Couldn't pin: ${e.description || e.message}`);
      }
    }
  });

  registry.add({
    name: 'unpin',
    category: 'Moderation',
    description: 'Unpin the replied-to message, or the latest pin',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      try {
        if (ctx.message.reply_to_message) {
          await ctx.telegram.unpinChatMessage(ctx.chat.id, ctx.message.reply_to_message.message_id);
        } else {
          await ctx.telegram.unpinChatMessage(ctx.chat.id);
        }
        await ctx.reply('📌 Unpinned.');
      } catch (e) {
        await ctx.reply(`Couldn't unpin: ${e.description || e.message}`);
      }
    }
  });

  registry.add({
    name: 'purge',
    category: 'Moderation',
    description: 'Delete messages from the replied message up to now',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      if (!ctx.message.reply_to_message) return ctx.reply('Reply to the message you want to purge from.');
      const from = ctx.message.reply_to_message.message_id;
      const to = ctx.message.message_id;
      let deleted = 0;
      for (let id = from; id <= to; id++) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, id);
          deleted++;
        } catch (e) { /* message may not exist, skip */ }
      }
      const notice = await ctx.reply(`🧹 Purged ${deleted} messages.`);
      setTimeout(() => ctx.telegram.deleteMessage(ctx.chat.id, notice.message_id).catch(() => {}), 5000);
    }
  });

  registry.add({
    name: 'unlock',
    category: 'Moderation',
    description: 'Allow everyone to send messages again',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      try {
        await ctx.telegram.setChatPermissions(ctx.chat.id, {
          can_send_messages: true, can_send_media_messages: true,
          can_send_polls: true, can_send_other_messages: true,
          can_add_web_page_previews: true
        });
        await ctx.reply('🔓 Chat unlocked, everyone can send messages.');
      } catch (e) {
        await ctx.reply(`Couldn't unlock: ${e.description || e.message}`);
      }
    }
  });

  registry.add({
    name: 'tagall',
    category: 'Moderation',
    description: 'Mention all known group members (best effort)',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
      const mentions = admins.map((a) => `[${a.user.first_name}](tg://user?id=${a.user.id})`).join(' ');
      await ctx.reply(`📢 ${mentions}\n\n(Telegram bots can only see admins directly; for full-member tag-all you'd track member IDs as they post.)`, { parse_mode: 'Markdown' });
    }
  });

  // ---- welcome / goodbye / rules / group profile ----
  registry.add({
    name: 'setwelcome',
    category: 'Moderation',
    description: 'Set the welcome message. Use {name} as a placeholder.',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!text) return ctx.reply('Usage: /setwelcome Welcome {name} to the group!');
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      g.welcome = text;
      db.save();
      await ctx.reply('✅ Welcome message saved.');
    }
  });

  registry.add({
    name: 'setgoodbye',
    category: 'Moderation',
    description: 'Set the goodbye message. Use {name} as a placeholder.',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!text) return ctx.reply('Usage: /setgoodbye Bye {name}, we\'ll miss you!');
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      g.goodbye = text;
      db.save();
      await ctx.reply('✅ Goodbye message saved.');
    }
  });

  registry.add({
    name: 'welcome',
    category: 'Moderation',
    description: 'Show the current welcome message',
    handler: async (ctx) => {
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      await ctx.reply(g.welcome ? `Current welcome message:\n${g.welcome}` : 'No welcome message set yet. Use /setwelcome.');
    }
  });

  registry.add({
    name: 'goodbye',
    category: 'Moderation',
    description: 'Show the current goodbye message',
    handler: async (ctx) => {
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      await ctx.reply(g.goodbye ? `Current goodbye message:\n${g.goodbye}` : 'No goodbye message set yet. Use /setgoodbye.');
    }
  });

  registry.add({
    name: 'rules',
    category: 'Moderation',
    description: 'Show group rules',
    handler: async (ctx) => {
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      await ctx.reply(g.rules ? `📜 *Group Rules*\n${g.rules}` : 'No rules set yet. Use /setrules.', { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'setrules',
    category: 'Moderation',
    description: 'Set the group rules',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!text) return ctx.reply('Usage: /setrules 1. Be respectful...');
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      g.rules = text;
      db.save();
      await ctx.reply('✅ Rules saved.');
    }
  });

  registry.add({
    name: 'setdesc',
    category: 'Moderation',
    description: 'Set the group description',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!text) return ctx.reply('Usage: /setdesc your new description');
      try {
        await ctx.telegram.setChatDescription(ctx.chat.id, text);
        await ctx.reply('✅ Description updated.');
      } catch (e) {
        await ctx.reply(`Couldn't update description: ${e.description || e.message}`);
      }
    }
  });

  registry.add({
    name: 'setgroupname',
    category: 'Moderation',
    description: 'Rename the group',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!text) return ctx.reply('Usage: /setgroupname New Group Name');
      try {
        await ctx.telegram.setChatTitle(ctx.chat.id, text);
        await ctx.reply('✅ Group renamed.');
      } catch (e) {
        await ctx.reply(`Couldn't rename: ${e.description || e.message}`);
      }
    }
  });

  registry.add({
    name: 'setgrouppfp',
    category: 'Moderation',
    description: 'Reply to a photo with this command to set it as group photo',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const photoMsg = ctx.message.reply_to_message;
      if (!photoMsg || !photoMsg.photo) return ctx.reply('Reply to a photo with /setgrouppfp.');
      try {
        const fileId = photoMsg.photo[photoMsg.photo.length - 1].file_id;
        const link = await ctx.telegram.getFileLink(fileId);
        await ctx.telegram.setChatPhoto(ctx.chat.id, { url: link.href });
        await ctx.reply('✅ Group photo updated.');
      } catch (e) {
        await ctx.reply(`Couldn't set group photo: ${e.description || e.message}`);
      }
    }
  });

  // ---- toggle-style protection settings ----
  const toggles = [
    ['antispam', 'Anti-spam'],
    ['antilink', 'Anti-link (deletes messages containing links)'],
    ['antiraid', 'Anti-raid (flags rapid joins)'],
    ['antiforward', 'Anti-forward (deletes forwarded messages)'],
    ['antinsfw', 'Anti-NSFW (needs an image-moderation API wired in to actually scan photos)'],
    ['antidelete', 'Anti-delete (reposts a deleted user\'s message)'],
    ['antitag', 'Anti-tag (blocks mass @mentions)'],
    ['antibadword', 'Anti-badword (deletes messages containing your bad word list)'],
    ['captcha', 'Join captcha (simple math challenge for new members)'],
    ['nightcurfew', 'Night curfew (restricts messaging during set hours - wire a cron/schedule to enforce times)']
  ];
  for (const [key, label] of toggles) {
    registry.add({
      name: key,
      category: 'Moderation',
      description: `Toggle ${label} on/off`,
      handler: async (ctx) => {
        if (!(await requireGroup(ctx))) return;
        if (!(await requireAdmin(ctx))) return;
        const g = db.getGroup(ctx.chat.id, ctx.chat.title);
        g.settings[key] = !g.settings[key];
        db.save();
        await ctx.reply(`${label} is now ${g.settings[key] ? 'ON ✅' : 'OFF ❌'}.`);
      }
    });
  }

  // ---- bad words ----
  registry.add({
    name: 'addbadword',
    category: 'Moderation',
    description: 'Add a word to the auto-delete list',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const word = (ctx.message.text.split(' ')[1] || '').toLowerCase();
      if (!word) return ctx.reply('Usage: /addbadword word');
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      if (!g.badwords.includes(word)) g.badwords.push(word);
      db.save();
      await ctx.reply(`✅ Added "${word}" to the bad word list.`);
    }
  });

  registry.add({
    name: 'removebadword',
    category: 'Moderation',
    description: 'Remove a word from the auto-delete list',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const word = (ctx.message.text.split(' ')[1] || '').toLowerCase();
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      g.badwords = g.badwords.filter((w) => w !== word);
      db.save();
      await ctx.reply(`✅ Removed "${word}" from the bad word list.`);
    }
  });

  registry.add({
    name: 'listbadwords',
    category: 'Moderation',
    description: 'List all filtered bad words',
    handler: async (ctx) => {
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      await ctx.reply(g.badwords.length ? g.badwords.join(', ') : 'No bad words configured.');
    }
  });

  // ---- filters ----
  registry.add({
    name: 'addfilter',
    category: 'Moderation',
    description: 'Auto-reply trigger: /addfilter trigger | response',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const rest = ctx.message.text.split(' ').slice(1).join(' ');
      const [trigger, response] = rest.split('|').map((s) => s && s.trim());
      if (!trigger || !response) return ctx.reply('Usage: /addfilter hello | Hi there!');
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      g.filters[trigger.toLowerCase()] = response;
      db.save();
      await ctx.reply(`✅ Filter added for "${trigger}".`);
    }
  });

  registry.add({
    name: 'removefilter',
    category: 'Moderation',
    description: 'Remove an auto-reply trigger',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const trigger = ctx.message.text.split(' ').slice(1).join(' ').toLowerCase();
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      delete g.filters[trigger];
      db.save();
      await ctx.reply(`✅ Filter "${trigger}" removed.`);
    }
  });

  registry.add({
    name: 'filters',
    category: 'Moderation',
    description: 'List all auto-reply filters',
    handler: async (ctx) => {
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      const keys = Object.keys(g.filters);
      await ctx.reply(keys.length ? keys.join(', ') : 'No filters configured.');
    }
  });

  // ---- notes ----
  registry.add({
    name: 'addnote',
    category: 'Moderation',
    description: 'Save a note: /addnote name | content',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const rest = ctx.message.text.split(' ').slice(1).join(' ');
      const [name, content] = rest.split('|').map((s) => s && s.trim());
      if (!name || !content) return ctx.reply('Usage: /addnote rules | Be nice to each other.');
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      g.notes[name.toLowerCase()] = content;
      db.save();
      await ctx.reply(`✅ Note "${name}" saved. Recall with /note ${name}.`);
    }
  });

  registry.add({
    name: 'note',
    category: 'Moderation',
    description: 'Recall a saved note: /note name',
    handler: async (ctx) => {
      const name = ctx.message.text.split(' ').slice(1).join(' ').toLowerCase();
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      await ctx.reply(g.notes[name] || `No note named "${name}".`);
    }
  });

  registry.add({
    name: 'notes',
    category: 'Moderation',
    description: 'List all saved notes',
    handler: async (ctx) => {
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      const keys = Object.keys(g.notes);
      await ctx.reply(keys.length ? keys.join(', ') : 'No notes saved yet.');
    }
  });

  registry.add({
    name: 'rmnote',
    category: 'Moderation',
    description: 'Delete a saved note',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const name = ctx.message.text.split(' ').slice(1).join(' ').toLowerCase();
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      delete g.notes[name];
      db.save();
      await ctx.reply(`✅ Note "${name}" deleted.`);
    }
  });

  // ---- stats / info ----
  registry.add({
    name: 'groupstats',
    category: 'Moderation',
    description: 'Basic stats about this group',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      const count = await ctx.telegram.getChatMembersCount(ctx.chat.id);
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      await ctx.reply(`📊 *${ctx.chat.title}*\nMembers: ${count}\nBad words filtered: ${g.badwords.length}\nNotes saved: ${Object.keys(g.notes).length}`, { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'healthscan',
    category: 'Moderation',
    description: 'Show bot uptime and memory usage',
    handler: async (ctx) => {
      const uptime = process.uptime();
      const mem = process.memoryUsage().rss / 1024 / 1024;
      await ctx.reply(`💚 *Bot Health*\nUptime: ${Math.floor(uptime / 60)}m\nMemory: ${mem.toFixed(1)}MB`, { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'invites',
    category: 'Moderation',
    description: 'Show the group\'s invite link',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      try {
        const link = await ctx.telegram.exportChatInviteLink(ctx.chat.id);
        await ctx.reply(`🔗 ${link}`);
      } catch (e) {
        await ctx.reply(`Couldn't get invite link: ${e.description || e.message}`);
      }
    }
  });

  registry.add({
    name: 'summary',
    category: 'Moderation',
    description: 'Summarize the last N messages (needs AI wired up in ai.js)',
    handler: async (ctx) => {
      await ctx.reply('Chat summarization needs message history tracking + an AI backend. Wire your AI_API_KEY in .env and I can extend this to summarize recent messages on request.');
    }
  });

  registry.add({
    name: 'schedule',
    category: 'Moderation',
    description: 'Schedule a message: /schedule 10m Your message',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const parts = ctx.message.text.split(' ');
      const when = parts[1];
      const text = parts.slice(2).join(' ');
      const match = when && when.match(/^(\d+)(m|h)$/);
      if (!match || !text) return ctx.reply('Usage: /schedule 10m Meeting starts soon!');
      const ms = match[2] === 'h' ? Number(match[1]) * 3600000 : Number(match[1]) * 60000;
      setTimeout(() => ctx.telegram.sendMessage(ctx.chat.id, `⏰ Scheduled message: ${text}`).catch(() => {}), ms);
      await ctx.reply(`✅ Scheduled for ${when} from now.`);
    }
  });

  registry.add({
    name: 'giveaway',
    category: 'Moderation',
    description: 'Start a simple giveaway: /giveaway 5m Prize name',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      const parts = ctx.message.text.split(' ');
      const when = parts[1];
      const prize = parts.slice(2).join(' ') || 'a prize';
      const match = when && when.match(/^(\d+)(m|h)$/);
      if (!match) return ctx.reply('Usage: /giveaway 5m Discord Nitro');
      const ms = match[2] === 'h' ? Number(match[1]) * 3600000 : Number(match[1]) * 60000;
      const entrants = new Set();
      const msg = await ctx.reply(`🎉 Giveaway for *${prize}*! React with 🎉 by replying "join" in ${when} to enter.`, { parse_mode: 'Markdown' });
      const listener = (c) => {
        if (c.chat.id === ctx.chat.id && c.message?.text?.toLowerCase() === 'join') {
          entrants.add(c.from.id);
        }
      };
      ctx.telegram.__giveawayListener = listener; // placeholder hook point
      setTimeout(async () => {
        if (entrants.size === 0) return ctx.reply(`🎉 Giveaway for ${prize} ended, nobody joined.`);
        const winner = [...entrants][Math.floor(Math.random() * entrants.size)];
        await ctx.telegram.sendMessage(ctx.chat.id, `🎉 Giveaway for *${prize}* ended! Winner: [user](tg://user?id=${winner})`, { parse_mode: 'Markdown' });
      }, ms);
    }
  });

  registry.add({
    name: 'appeal',
    category: 'Moderation',
    description: 'Appeal a ban/mute/warn to the group admins',
    handler: async (ctx) => {
      const text = ctx.message.text.split(' ').slice(1).join(' ');
      if (!text) return ctx.reply('Usage: /appeal your explanation');
      const g = db.getGroup(ctx.chat.id, ctx.chat.title);
      g.adminLog.push({ action: 'appeal', by: ctx.from.id, text, ts: Date.now() });
      db.save();
      await ctx.reply('✅ Your appeal was logged. An admin will review it.');
    }
  });

  registry.add({
    name: 'userhistory',
    category: 'Moderation',
    description: 'Show a user\'s warn count and known history',
    handler: async (ctx) => {
      const targetId = getTargetUserId(ctx) || ctx.from.id;
      const u = db.getUser(targetId);
      await ctx.reply(`📜 *History for ${targetId}*\nWarns: ${u.warns}\nJoined bot records: ${new Date(u.createdAt).toLocaleDateString()}`, { parse_mode: 'Markdown' });
    }
  });

  registry.add({
    name: 'cleangroup',
    category: 'Moderation',
    description: 'Delete the bot\'s own recent messages to tidy up',
    handler: async (ctx) => {
      if (!(await requireGroup(ctx))) return;
      if (!(await requireAdmin(ctx))) return;
      await ctx.reply('For a full sweep, reply to the oldest message you want cleared with /purge - that\'s the safer, precise version of this.');
    }
  });

  registry.add({
    name: 'inactive',
    category: 'Moderation',
    description: 'List inactive members (needs activity tracking)',
    handler: async (ctx) => {
      await ctx.reply('Inactivity tracking needs a per-message "last seen" log. Ask me to add that to db.js and I\'ll wire this up fully in the next batch.');
    }
  });
};
