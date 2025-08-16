function fromMediaSession() {
	try {
		const md = navigator.mediaSession?.metadata;
		if (md && (md.title || md.artist)) return { title: md.title || '', artist: md.artist || '' };
	} catch {}
	return null;
}

function fromYouTube() {
	try {
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
		const titleEl = document.querySelector('ytmusic-player-bar .title, #song-title, yt-formatted-string.title');
		const bylineEl = document.querySelector('ytmusic-player-bar .byline, .subtitle, #subtitle');
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

function fromAmazonMusic() {
	try {
		const title = document.querySelector('.trackTitle, .song-title, [data-test-id="current-track-title"]')?.textContent?.trim();
		const artist = document.querySelector('.trackArtist, .subtitle-artist, [data-test-id="current-track-subtitle"]')?.textContent?.trim();
		return (title || artist) ? { title, artist } : null;
	} catch {}
	return null;
}

function fromDeezer() {
	try {
		const title = document.querySelector('#player_track_title, .player-track-title')?.textContent?.trim();
		const artist = document.querySelector('#player_artist_name, .player-track-artist')?.textContent?.trim();
		return (title || artist) ? { title, artist } : null;
	} catch {}
	return null;
}

function fromTidal() {
	try {
		const title = document.querySelector('[data-test="currently-playing-title"], .now-playing__track')?.textContent?.trim();
		const artist = document.querySelector('[data-test="currently-playing-artist"], .now-playing__artist')?.textContent?.trim();
		return (title || artist) ? { title, artist } : null;
	} catch {}
	return null;
}

function fromPandora() {
	try {
		const title = document.querySelector('.MarqueeContent, .nowPlayingTopInfo__current__trackName')?.textContent?.trim();
		const artist = document.querySelector('.nowPlayingTopInfo__current__artistName')?.textContent?.trim();
		return (title || artist) ? { title, artist } : null;
	} catch {}
	return null;
}

function fromBandcamp() {
	try {
		const title = document.querySelector('#trackInfo .title, .title')?.textContent?.trim();
		const artist = document.querySelector('#name-section span[itemprop="byArtist"], .artist')?.textContent?.trim();
		return (title || artist) ? { title, artist } : null;
	} catch {}
	return null;
}

function fromSpotify() {
	try {
		const title = document.querySelector('[data-testid="now-playing-widget"] [data-testid="context-item-link"]')?.textContent?.trim();
		const artist = document.querySelector('[data-testid="now-playing-widget"] [dir] a[href*="artist"]')?.textContent?.trim();
		return (title || artist) ? { title, artist } : null;
	} catch {}
	return null;
}

function fromShazam() {
	try {
		const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
			.map(n => { try { return JSON.parse(n.textContent || '{}'); } catch { return null; } })
			.find(j => j && (j['@type'] === 'MusicRecording' || j['@type'] === 'MusicAlbum'));
		if (ld) {
			const title = (ld.name || '').trim();
			const artist = (ld.byArtist?.name || ld.byArtist || '').toString().trim();
			if (title || artist) return { title, artist };
		}
		const ogt = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
		const ogd = document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim();
		if (ogt && ogt.includes(' - ')) {
			const [t, a] = ogt.split(' - ');
			return { title: t.trim(), artist: (a || '').trim() };
		}
		if (ogd && ogd.includes(' · ')) {
			const [a, t] = ogd.split(' · ');
			return { title: (t || '').trim(), artist: (a || '').trim() };
		}
		const title = document.querySelector('h1, h2')?.textContent?.trim();
		const artist = document.querySelector('a[href*="/artist/"], [data-testid*="artist"], .artist')?.textContent?.trim() || '';
		return (title || artist) ? { title, artist } : null;
	} catch {}
	return null;
}

function detect() {
	// Only run on supported music streaming sites
	const host = location.host;
	const supportedSites = [
		'youtube.com', 'youtu.be', 'music.youtube.com',
		'soundcloud.com', 'music.apple.com', 'music.amazon.com',
		'deezer.com', 'pandora.com', 'tidal.com', 'listen.tidal.com',
		'bandcamp.com', 'open.spotify.com', 'shazam.com', 'www.shazam.com'
	];
	
	// Check if we're on a supported site
	const isSupportedSite = supportedSites.some(site => host.includes(site));
	if (!isSupportedSite) {
		return null; // Don't run on unsupported sites
	}
	
	const viaMS = fromMediaSession();
	if (viaMS) return viaMS;
	
	if (host.includes('music.youtube.com')) return fromYouTubeMusic() || viaMS;
	if (host.includes('youtube.com') || host.includes('youtu.be')) return fromYouTube() || viaMS;
	if (host.includes('soundcloud.com')) return fromSoundCloud() || viaMS;
	if (host.includes('music.apple.com')) return fromAppleMusic() || viaMS;
	if (host.includes('music.amazon.')) return fromAmazonMusic() || viaMS;
	if (host.includes('deezer.com')) return fromDeezer() || viaMS;
	if (host.includes('tidal.com')) return fromTidal() || viaMS;
	if (host.includes('pandora.com')) return fromPandora() || viaMS;
	if (host.includes('bandcamp.com')) return fromBandcamp() || viaMS;
	if (host.includes('open.spotify.com')) return fromSpotify() || viaMS;
	if (host.includes('shazam.com')) return fromShazam() || viaMS;
	
	// Only return media session data if we're on a supported site
	return viaMS;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg?.type === 'getCurrentSongGuess') {
		try { sendResponse({ ok: true, data: detect() }); }
		catch (e) { sendResponse({ ok: false, error: String(e?.message || e) }); }
		return true;
	}
});
