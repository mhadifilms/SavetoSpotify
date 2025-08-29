function fromMediaSession() {
	try {
		const md = navigator.mediaSession?.metadata;
		if (md && (md.title || md.artist)) return { title: md.title || '', artist: md.artist || '' };
	} catch {}
	return null;
}

function fromYouTube() {
	try {
		// Only on watch pages
		if (!(/[?&]v=/.test(location.search))) return null;
		// Require active playback state or a playing <video>
		const state = navigator.mediaSession?.playbackState;
		const video = document.querySelector('video');
		const isPlaying = (state === 'playing') || (!!video && video.paused === false && video.currentTime > 0);
		if (!isPlaying) return null;
		// Prefer MediaSession metadata
		const ms = navigator.mediaSession?.metadata;
		if (ms && (ms.title || ms.artist)) return { title: ms.title || '', artist: ms.artist || '' };
		// Fallback to meta when playing
		const metaTitle = document.querySelector('meta[itemprop="name"]')?.getAttribute('content');
		const byline = document.querySelector('#owner-name a, ytd-channel-name a');
		const title = (metaTitle || document.title.replace(' - YouTube', '')).trim();
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
	const host = location.host;
	const supportedSites = [
		'youtube.com', 'youtu.be', 'music.youtube.com',
		'soundcloud.com', 'music.apple.com', 'music.amazon.com',
		'deezer.com', 'pandora.com', 'tidal.com', 'listen.tidal.com',
		'bandcamp.com', 'open.spotify.com', 'shazam.com', 'www.shazam.com'
	];
	const isSupportedSite = supportedSites.some(site => host.includes(site));
	if (!isSupportedSite) return null;
	
	// Prefer active playback via MediaSession
	const viaMS = fromMediaSession();
	if (viaMS && (viaMS.title || viaMS.artist)) return viaMS;
	
	// Site-specific: only read when dedicated now-playing elements have content
	if (host.includes('music.youtube.com')) {
		const r = fromYouTubeMusic();
		return (r && (r.title || r.artist)) ? r : null;
	}
	if (host.includes('youtube.com') || host.includes('youtu.be')) {
		// Only when a video title element is inside the player page layout
		const isWatch = /[?&]v=/.test(location.search);
		if (!isWatch) return null;
		const r = fromYouTube();
		return (r && (r.title || r.artist)) ? r : null;
	}
	if (host.includes('soundcloud.com')) {
		const r = fromSoundCloud();
		return (r && (r.title || r.artist)) ? r : null;
	}
	if (host.includes('music.apple.com')) {
		const r = fromAppleMusic();
		return (r && (r.title || r.artist)) ? r : null;
	}
	if (host.includes('music.amazon.')) { const r = fromAmazonMusic(); return (r && (r.title || r.artist)) ? r : null; }
	if (host.includes('deezer.com')) { const r = fromDeezer(); return (r && (r.title || r.artist)) ? r : null; }
	if (host.includes('tidal.com')) { const r = fromTidal(); return (r && (r.title || r.artist)) ? r : null; }
	if (host.includes('pandora.com')) { const r = fromPandora(); return (r && (r.title || r.artist)) ? r : null; }
	if (host.includes('bandcamp.com')) { const r = fromBandcamp(); return (r && (r.title || r.artist)) ? r : null; }
	if (host.includes('open.spotify.com')) { const r = fromSpotify(); return (r && (r.title || r.artist)) ? r : null; }
	if (host.includes('shazam.com')) { const r = fromShazam(); return (r && (r.title || r.artist)) ? r : null; }
	return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg?.type === 'getCurrentSongGuess') {
		try { sendResponse({ ok: true, data: detect() }); }
		catch (e) { sendResponse({ ok: false, error: String(e?.message || e) }); }
		return true;
	}
});

(async function shazamButton() {
	try {
		const host = location.host;
		if (!/(^|\.)shazam\.com$/.test(host)) return;
		// Check user setting (default true)
		let enabled = true;
		try {
			const { enableShazamButton } = await chrome.storage.sync.get('enableShazamButton');
			enabled = enableShazamButton !== false;
		} catch {}
		if (!enabled) return;
		// Cache popup URL once; avoid runtime calls after potential invalidation
		const POPUP_URL = (() => { try { return chrome.runtime.getURL('popup.html'); } catch { return null; } })();
		
		function findAnchorEl() {
			const byTestId = document.querySelector('[data-testid*="share" i]');
			if (byTestId) return byTestId;
			const allBtns = Array.from(document.querySelectorAll('button, a'));
			const share = allBtns.find(el => /\bshare\b/i.test(el.textContent || el.ariaLabel || ''));
			if (share) return share;
			const play = allBtns.find(el => /play full song/i.test(el.textContent || ''));
			return play || null;
		}
		
		function styleLike(anchor, btn) {
			const cs = anchor ? getComputedStyle(anchor) : null;
			const rect = anchor ? anchor.getBoundingClientRect() : null;
			const hNum = rect && rect.height ? rect.height : (cs && cs.height && cs.height !== 'auto' ? parseFloat(cs.height) : 44);
			const wNum = rect && rect.width ? rect.width : (cs && cs.width && cs.width !== 'auto' ? parseFloat(cs.width) : 140);
			const heightPx = Math.max(1, Math.round(hNum)) + 'px';
			const widthPx = Math.max(1, Math.round(wNum)) + 'px';
			const radiusPx = Math.round(hNum / 2) + 'px';
			const baseFont = cs && cs.fontSize ? parseFloat(cs.fontSize) : 14;
			const fontPx = Math.round(baseFont) + 'px';
			
			btn.style.display = 'inline-flex';
			btn.style.alignItems = 'center';
			btn.style.justifyContent = 'center';
			btn.style.verticalAlign = 'middle';
			btn.style.whiteSpace = 'nowrap';
			btn.style.flex = '0 0 auto';
			btn.style.boxSizing = 'border-box';
			btn.style.gap = '8px';
			btn.style.fontWeight = '700'; // bold
			btn.style.fontSize = fontPx; // same size as SHARE
			btn.style.fontFamily = (cs && cs.fontFamily) || "'Neue Montreal','neue-montreal','NeueMontreal', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
			btn.style.textTransform = 'uppercase';
			btn.style.height = heightPx;
			btn.style.width = widthPx;
			btn.style.minWidth = widthPx;
			btn.style.maxWidth = widthPx;
			btn.style.borderRadius = radiusPx; // perfect pill
			btn.style.padding = '0';
			btn.style.lineHeight = '1';
			btn.style.border = '0';
			btn.style.cursor = 'pointer';
			btn.style.background = '#1db954';
			btn.style.color = '#000';
			btn.style.margin = '0';
			btn.style.alignSelf = 'center';
			btn.style.boxShadow = 'none';
			btn.style.transition = 'filter .15s ease';
			btn.onmouseenter = () => (btn.style.filter = 'brightness(1.05)');
			btn.onmouseleave = () => (btn.style.filter = 'none');
		}
		
		function ensureButton() {
			let btn = document.getElementById('sts-shazam-save-btn');
			const anchor = findAnchorEl();
			if (!anchor) return false;
			// Create wrapper and insert...
			let wrapper = anchor.parentElement && anchor.parentElement.id === 'sts-share-wrap'
				? anchor.parentElement
				: document.getElementById('sts-share-wrap');
			if (!wrapper) {
				const parent = anchor.parentElement;
				if (!parent) return false;
				wrapper = document.createElement('span');
				wrapper.id = 'sts-share-wrap';
				wrapper.style.display = 'inline-flex';
				wrapper.style.alignItems = 'center';
				wrapper.style.gap = '12px';
				wrapper.style.whiteSpace = 'nowrap';
				wrapper.style.verticalAlign = 'middle';
				wrapper.style.flex = '0 0 auto';
				parent.insertBefore(wrapper, anchor);
				wrapper.appendChild(anchor);
			}
			
			if (!btn) {
				btn = document.createElement('button');
				btn.id = 'sts-shazam-save-btn';
				btn.type = 'button';
				btn.textContent = 'SAVE TO SPOTIFY';
				// Prepend small icon
				const ico = document.createElement('img');
				ico.src = chrome.runtime.getURL('icons/icon48.png');
				ico.alt = '';
				ico.style.width = '16px'; ico.style.height = '16px'; ico.style.marginRight = '6px';
				btn.prepend(ico);
				styleLike(anchor, btn);
				wrapper.insertBefore(btn, anchor.nextSibling);
				btn.addEventListener('click', openOverlay);
				return true;
			}
			if (!btn.isConnected) {
				btn.textContent = 'SAVE TO SPOTIFY';
				// Ensure icon exists
				if (!btn.querySelector('img')) {
					const ico = document.createElement('img');
					ico.src = chrome.runtime.getURL('icons/icon16.png');
					ico.alt = '';
					ico.style.width = '16px'; ico.style.height = '16px'; ico.style.marginRight = '8px';
					btn.prepend(ico);
				}
				styleLike(anchor, btn);
				wrapper.insertBefore(btn, anchor.nextSibling);
			}
			return true;
		}
		
		function openOverlay() {
			try {
				if (!POPUP_URL) return; // runtime unavailable (e.g., during update)
				if (document.getElementById('sts-overlay')) return;
				const overlay = document.createElement('div');
				overlay.id = 'sts-overlay';
				overlay.style.cssText = 'position:fixed; inset:0; z-index:2147483647; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center;';
				const frame = document.createElement('iframe');
				frame.src = POPUP_URL;
				frame.style.cssText = 'width:560px; height:640px; border:0; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.5); background:#121212;';
				const close = (e) => { if (e.target === overlay) overlay.remove(); };
				overlay.addEventListener('click', close);
				overlay.appendChild(frame);
				document.body.appendChild(overlay);
			} catch (err) {
				// Gracefully ignore context invalidation without crashing the page
			}
		}
		
		// Initial attempt and keep-alive
		ensureButton();
		
		// Simple mutation observer for dynamic content changes
		const mo = new MutationObserver(() => { 
			ensureButton(); 
		});
		mo.observe(document.documentElement, { 
			childList: true, 
			subtree: true
		});
		
		// Keep-alive interval
		const iv = setInterval(ensureButton, 2000);
		window.addEventListener('pagehide', () => clearInterval(iv));
	} catch {}
})();
