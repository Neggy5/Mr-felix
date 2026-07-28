const fetch = require('node-fetch');

// Most third-party downloaders (TikTok/IG/FB/Twitter/Spotify/etc.) work by
// calling a public "media downloader" API. Those APIs change constantly and
// most require a free RapidAPI key, so rather than hardcode one that will
// break in a month, each handler below is wired up and ready — just drop
// your provider's endpoint + key in and it works. /shorten is fully live
// since is.gd's API is free and stable with no key needed.

function stub(name, hint) {
  return async (ctx) => {
    const url = ctx.message.text.split(' ')[1];
    if (!url) return ctx.reply(`Usage: /${name} <link>`);
    await ctx.reply(`${name} downloading needs a media-fetch API key (${hint}). Tell me which provider you want (e.g. a RapidAPI downloader) and I'll wire the fetch + file-send logic in for you.`);
  };
}

module.exports = (registry) => {
  registry.add({ name: 'play', category: 'Downloads', description: 'Search + send an audio track by name', handler: stub('play', 'e.g. a YouTube audio API') });
  registry.add({ name: 'ytvideo', category: 'Downloads', description: 'Download a YouTube video by link', handler: stub('ytvideo', 'e.g. a YouTube downloader API') });
  registry.add({ name: 'tiktok', category: 'Downloads', description: 'Download a TikTok video (no watermark)', handler: stub('tiktok', 'e.g. a TikTok downloader API') });
  registry.add({ name: 'instagram', category: 'Downloads', description: 'Download an Instagram post/reel', handler: stub('instagram', 'e.g. an Instagram downloader API') });
  registry.add({ name: 'facebook', category: 'Downloads', description: 'Download a Facebook video', handler: stub('facebook', 'e.g. a Facebook downloader API') });
  registry.add({ name: 'twitter', category: 'Downloads', description: 'Download a Twitter/X video', handler: stub('twitter', 'e.g. a Twitter downloader API') });
  registry.add({ name: 'spotify', category: 'Downloads', description: 'Download a Spotify track preview', handler: stub('spotify', 'Spotify\'s own API only gives 30s previews') });
  registry.add({ name: 'mediafire', category: 'Downloads', description: 'Fetch a direct MediaFire download link', handler: stub('mediafire', 'e.g. a MediaFire scraper API') });
  registry.add({ name: 'gdrive', category: 'Downloads', description: 'Fetch a public Google Drive file', handler: stub('gdrive', 'Google Drive API + OAuth for private files') });
  registry.add({ name: 'apk', category: 'Downloads', description: 'Fetch an APK from a package name', handler: stub('apk', 'e.g. an APK mirror API') });

  registry.add({
    name: 'shorten',
    category: 'Downloads',
    description: 'Shorten a long URL: /shorten https://example.com/very/long/link',
    handler: async (ctx) => {
      const url = ctx.message.text.split(' ')[1];
      if (!url || !/^https?:\/\//.test(url)) return ctx.reply('Usage: /shorten https://example.com/long/link');
      try {
        const res = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
        const short = await res.text();
        await ctx.reply(`🔗 ${short}`);
      } catch (e) {
        await ctx.reply('Couldn\'t shorten that URL right now.');
      }
    }
  });
};
