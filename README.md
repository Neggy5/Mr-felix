# zuko MD — Telegram Bot

A Telegram bot built with [Telegraf](https://telegraf.js.org/), covering General, Moderation, Economy, Games & Fun, Checks, Social, AI & Tools, Downloads, and a Kill & War / Mafia game module — matching the command menu you sent over.

## What's fully working right now

- **General**: start, help/allcmd, ping, id, userinfo/whois, rank, calc, feedback/suggest, report
- **Moderation**: ban, unban, kick, mute, unmute, warn system with configurable limit/action, promote/demote, adminlist/adminlogs, pin/unpin, purge, unlock, tagall, welcome/goodbye/rules/setdesc/setgroupname/setgrouppfp, all the anti-* toggles (antilink and antibadword actively enforce; the rest are wired as on/off settings ready for enforcement logic), bad word list, filters, notes, groupstats, healthscan, invites, schedule, giveaway, appeal, userhistory
- **Economy**: balance/wallet, daily, streak, work, hustle, crime, rob, loan/repayloan/myloan, deposit/withdraw, give/donate, shop/sell (buy), inventory, auction (relay), leaderboard, networth, richme, profile, spy
- **Games & Fun**: coinflip/gamble, slots, roll, numguess, trivia, joke, quote, 8ball, wyr, truth, dare, tod, choose, lovecalc, rate, horoscope, confession, rapbattle, roastbattle, blackjack
- **Checks**: hotcheck, stupidcheck, smartcheck, evilcheck, gigachadcheck, simpcheck, coolcheck, dogcheck, greatcheck, waifucheck, uncleancheck, iq, pp
- **Social**: marry, divorce, spouse, ship, dm, afk (with auto-clear + "user is AFK" notices)
- **Kill & War / Mafia**: kill/revive (virtual game flag, no real content), addprotect/removeprotect, bounty/hitlist/wanted, duel, secbattle, teamup/teambattle/myteam/leaveteam, heist/joinheist, and a full `/mafia` state machine (start/join/begin/vote/endvote/kill/save/investigate/dawn/status/cancel)
- **AI & Tools**: `/ai` (plus the `gpt5`, `copilot`, `dolphin*`, `deepseek*`, `storygen` aliases all point at the same configurable AI backend), detectbugs, prompttocode, convertcode, explaincode, clearchat, weather, ip, remind
- `/shorten` is a real, working URL shortener (no API key needed)

## What's stubbed on purpose

A few commands genuinely need a paid or third-party API key to do anything real, so instead of shipping something that silently breaks, they reply explaining exactly what key/library to add: `/play`, `/ytvideo`, `/tiktok`, `/instagram`, `/facebook`, `/twitter`, `/spotify`, `/mediafire`, `/gdrive`, `/apk` (downloaders), `/ocr`, `/readqr`, `/tweetgen`, `/tweetprofiles`, `/ttstalk`, `/igstalk`, `/lyrics` (skipped entirely — reproducing song lyrics is a copyright issue, so this one replies with an explanation instead of fetching text). `/summary` and `/inactive` need message-history tracking that isn't built yet.

Send me the next batch and I'll wire these up with whatever provider/API key you want to use — same as the iterative approach from your other bots.

## Setup

All settings are hardcoded in `src/config.js` — there's no `.env` file.

```bash
npm install
# open src/config.js and edit the values directly (see below)
npm start
```

Talk to [@BotFather](https://t.me/BotFather) on Telegram to create the bot and get a token if you don't have one yet.

### Editing `src/config.js`

```js
BOT_TOKEN: 'PASTE_YOUR_BOT_TOKEN_HERE',   // from @BotFather
OWNER_IDS: [123456789],                    // your numeric Telegram ID, from @userinfobot
```

## Force-join gate

Every command is blocked until the user has joined both a channel and a group you configure. It's on by default — set `FORCE_JOIN.enabled: false` in `src/config.js` to turn it off.

```js
FORCE_JOIN: {
  enabled: true,
  channel: { id: '@YourChannelUsername', url: 'https://t.me/YourChannelUsername', label: '📢 Join Channel' },
  group:   { id: '@YourGroupUsername',   url: 'https://t.me/YourGroupUsername',   label: '💬 Join Group' }
}
```

- `id` is used for the membership check (`getChatMember`) — for public channels/groups the `@username` works fine.
- `url` is what the join button opens.
- **If either is private**, use its numeric chat ID (starts with `-100...`) for `id`, and make sure the bot is added as an **admin** of that chat — Telegram won't let a bot check membership otherwise.
- If the membership check errors out (bad ID, bot not an admin, etc.), it fails *open* (lets the user through) rather than locking everyone out, and logs the error so it's easy to spot in Railway's logs.

Users see two join buttons plus an "✅ I've Joined" button that re-checks their membership. On success it edits the message to confirm and unblocks every command going forward.

**On button color:** Telegram's Bot API doesn't let a bot set custom colors on inline buttons — that's controlled entirely by each user's client theme, not something a bot can override. URL buttons already render in the client's default link color (blue on the standard Telegram apps), so on default themes you'll get blue buttons automatically with no extra config.

## Deploying to Railway

1. Fill in `BOT_TOKEN`, `OWNER_IDS`, and `FORCE_JOIN` in `src/config.js` (and `AI_API_KEY`/`WEATHER_API_KEY` if you want those live) before pushing.
2. Push this folder to a GitHub repo.
3. On [railway.app](https://railway.app), create a new project → Deploy from GitHub repo. No environment variables are required since everything's hardcoded in `src/config.js`.
4. Railway auto-detects Node via Nixpacks and runs `npm start`. `railway.json` is already included with sane defaults.
5. **Data persistence**: by default this bot stores everything in `data/db.json` on disk, which resets on every redeploy because Railway's filesystem is ephemeral — the same issue you've run into before. Two options:
   - Quick fix: add a **Railway Volume** mounted at `/app/data` (Railway dashboard → your service → Volumes).
   - Better long-term: swap `src/db.js` for a real database (Mongo/Postgres/Supabase). The file only exports `getUser`, `getGroup`, `save`, `saveNow`, `allUsers`, `allGroups`, so this is a contained change.
6. The bot runs on **long polling**, not webhooks, so there's no need to expose a public URL for Telegram itself — the small Express server on `PORT` is only there so Railway's health check has something to ping.

## Project layout

```
src/
  index.js          bot bootstrap, command registration, passive middleware
  config.js         env var loading
  db.js             JSON file storage (see persistence note above)
  utils.js          shared helpers (admin checks, formatting, target resolution)
  registry.js        command registry used to build /help and wire Telegraf
  commands/
    general.js
    moderation.js
    economy.js
    games.js
    checks.js
    social.js
    ai.js
    downloads.js
    pvp.js           Kill & War + Mafia game
```

Adding a new command: open the right file in `src/commands/`, call `registry.add({ name, aliases, category, description, handler })`. It's automatically registered and shows up in `/help`.
