function fromMediaSession() {
  try {
    const md = navigator.mediaSession?.metadata;
    if (md && (md.title || md.artist)) {
      return { title: md.title || '', artist: md.artist || '' };
    }
  } catch {}
  return null;
}

function fromYouTube() {
  try {
    // Prefer the player metadata if available
    const md = document.querySelector('meta[itemprop="name"]');
    const byline = document.querySelector('#owner-name a, ytd-channel-name a');
    const title = md?.getAttribute('content') || document.title.replace(' - YouTube', '').trim();
    const artist = byline?.textContent?.trim() || '';
    return (title || artist) ? { title, artist } : null;
  } catch {}
  return null;
}

function fromYouTubeMusic() {
  try {
    const titleEl = document.querySelector('ytmusic-player-bar .title') || document.querySelector('#song-title') || document.querySelector('yt-formatted-string.title');
    const bylineEl = document.querySelector('ytmusic-player-bar .byline') || document.querySelector('.subtitle') || document.querySelector('#subtitle');
    const title = titleEl?.textContent?.trim() || '';
    const artist = bylineEl?.textContent?.trim() || '';
    return (title || artist) ? { title, artist } : null;
  } catch {}
  return null;
}

function fromSoundCloud() {
  try {
    const title = document.querySelector('.playbackSoundBadge__titleLink span[aria-hidden]')?.textContent?.trim()
      || document.querySelector('.playbackSoundBadge__titleLink')?.textContent?.trim();
    const artist = document.querySelector('.playbackSoundBadge__lightLink')?.textContent?.trim();
    return (title || artist) ? { title, artist } : null;
  } catch {}
  return null;
}

function fromAppleMusic() {
  try {
    const title = document.querySelector('[data-testid="web-player__currently-playing__song-name"]')?.textContent?.trim();
    const artist = document.querySelector('[data-testid="web-player__currently-playing__subtitle"]')?.textContent?.trim();
    return (title || artist) ? { title, artist } : null;
  } catch {}
  return null;
}

function detect() {
  const viaMS = fromMediaSession();
  if (viaMS) return viaMS;

  const host = location.host;
  if (host.includes('music.youtube.com')) return fromYouTubeMusic() || fromYouTube() || viaMS;
  if (host.includes('youtube.com') || host.includes('youtu.be')) return fromYouTube() || viaMS;
  if (host.includes('soundcloud.com')) return fromSoundCloud() || viaMS;
  if (host.includes('music.apple.com')) return fromAppleMusic() || viaMS;
  return viaMS || { title: document.title, artist: '' };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'getCurrentSongGuess') {
    try { sendResponse({ ok: true, data: detect() }); }
    catch (e) { sendResponse({ ok: false, error: String(e?.message || e) }); }
    return true;
  }
});
