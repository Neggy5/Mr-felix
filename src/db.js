// Lightweight JSON file "database". Good enough to get zuko MD running fast.
//
// KNOWN LIMITATION (same one you've hit before on Railway with other bots):
// Railway's default filesystem is ephemeral - data/db.json will reset on
// every redeploy/restart unless you attach a Railway Volume mounted at
// /app/data, or swap this module out for a real database (Mongo/Postgres/
// Supabase all work fine). The read/write API below is small on purpose so
// swapping the storage backend later is a one-file change.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

const DEFAULT_DATA = {
  users: {},   // userId -> user record
  groups: {}   // chatId -> group settings record
};

let data = loadSync();
let saveScheduled = false;

function loadSync() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveSync() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Debounced save so rapid-fire commands don't hammer disk I/O.
function scheduleSave() {
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(() => {
    saveScheduled = false;
    saveSync();
  }, 500);
}

function defaultUser(id, name) {
  return {
    id,
    name: name || 'Unknown',
    balance: 500,
    bank: 0,
    xp: 0,
    level: 1,
    warns: 0,
    inventory: [],
    marriedTo: null,
    loan: 0,
    lastDaily: 0,
    lastWork: 0,
    lastCrime: 0,
    lastRob: 0,
    dailyStreak: 0,
    afk: null, // { reason, since }
    createdAt: Date.now()
  };
}

function defaultGroup(id, title) {
  return {
    id,
    title: title || 'Unknown group',
    welcome: null,
    goodbye: null,
    rules: null,
    warnLimit: 3,
    warnAction: 'mute', // mute | kick | ban
    badwords: [],
    filters: {}, // trigger -> response
    notes: {},   // name -> text
    settings: {
      antispam: false,
      antilink: false,
      antiraid: false,
      antiforward: false,
      antinsfw: false,
      antidelete: false,
      antitag: false,
      antibadword: false,
      captcha: false,
      nightcurfew: false
    },
    recentMessages: {}, // userId -> [{id, text, ts}] used by /antidelete
    adminLog: [],
    createdAt: Date.now()
  };
}

function getUser(id, name) {
  const key = String(id);
  if (!data.users[key]) {
    data.users[key] = defaultUser(key, name);
    scheduleSave();
  } else if (name && data.users[key].name !== name) {
    data.users[key].name = name;
  }
  return data.users[key];
}

function getGroup(id, title) {
  const key = String(id);
  if (!data.groups[key]) {
    data.groups[key] = defaultGroup(key, title);
    scheduleSave();
  } else if (title && data.groups[key].title !== title) {
    data.groups[key].title = title;
  }
  return data.groups[key];
}

function save() {
  scheduleSave();
}

function saveNow() {
  saveSync();
}

function allUsers() {
  return data.users;
}

function allGroups() {
  return data.groups;
}

module.exports = { getUser, getGroup, save, saveNow, allUsers, allGroups };
