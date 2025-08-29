const qs = (s) => document.querySelector(s);
const statusEl = qs('#status');
const loginBtn = qs('#loginBtn');
const optionsBtn = qs('#optionsBtn');
const userAvatar = qs('#userAvatar');
const trackCard = qs('#track');
const matchCard = qs('#match');
const detectedTitle = qs('#detectedTitle');
const detectedArtist = qs('#detectedArtist');
const matchTitle = qs('#matchTitle');
const matchArtist = qs('#matchArtist');
const actions = qs('#actions');
const defaultView = qs('#defaultView');
const playlistSelector = qs('#playlistSelector');
const selectPlaylistBtn = qs('#selectPlaylistBtn');
const playlistSearch = qs('#playlistSearch');
const playlistList = qs('#playlistList');
const createPlaylistBtn = qs('#createPlaylistBtn');
const backToDefaultBtn = qs('#backToDefaultBtn');
const newPlaylistName = qs('#newPlaylistName');
const saveBtn = qs('#saveBtn');

let currentMatch = null;
let allPlaylists = [];
let selectedPlaylistId = '__liked__'; // Default to Liked Songs

function setStatus(text, type = 'info') {
	statusEl.textContent = text;
	statusEl.className = `status ${type}`;
}

async function getActiveTab() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab;
}

async function sendToActiveTab(message) {
	const tab = await getActiveTab();
	if (!tab?.id) throw new Error('No active tab');
	return chrome.tabs.sendMessage(tab.id, message);
}

async function ensureAuth() {
	const res = await chrome.runtime.sendMessage({ type: 'ensureAuth' });
	if (!res?.ok) throw new Error(res?.error || 'Auth failed');
}

async function detectTrack() {
	try {
		const res = await sendToActiveTab({ type: 'getCurrentSongGuess' });
		if (res?.ok) return res.data;
	} catch {}
	
	// If content script didn't respond, check if we're on a supported site
	const tab = await getActiveTab();
	const host = tab?.url ? new URL(tab.url).host : '';
	
	const supportedSites = [
		'youtube.com', 'youtu.be', 'music.youtube.com',
		'soundcloud.com', 'music.apple.com', 'music.amazon.com',
		'deezer.com', 'pandora.com', 'tidal.com', 'listen.tidal.com',
		'bandcamp.com', 'open.spotify.com', 'shazam.com', 'www.shazam.com'
	];
	
	const isSupportedSite = supportedSites.some(site => host.includes(site));
	if (!isSupportedSite) {
		return null; // Not on a supported site
	}
	
	return { title: tab?.title || '', artist: '' };
}

async function searchMatch(target) {
	const res = await chrome.runtime.sendMessage({ type: 'searchAndMatch', payload: target });
	if (!res?.ok) throw new Error(res?.error || 'Search failed');
	return res;
}

async function getPlaylists() {
	try {
	const res = await chrome.runtime.sendMessage({ type: 'getPlaylists' });
		
		if (!res?.ok) {
			throw new Error(res?.error || 'Playlists failed');
		}
		
	return res.playlists;
	} catch (error) {
		throw error;
	}
}

async function getMe() {
	try {
		const res = await chrome.runtime.sendMessage({ type: 'getMe' });
		if (!res?.ok) return null;
		return res.me;
	} catch { return null; }
}

function showPlaylistSelector() {
	// Hide non-selector UI to give full space
	qs('.header')?.classList.add('hidden');
	trackCard?.classList.add('hidden');
	matchCard?.classList.add('hidden');
	defaultView.classList.add('hidden');
	playlistSelector.classList.remove('hidden');
	// Reset create mode
	qs('#createForm')?.classList.add('hidden');
	qs('#playlistList')?.classList.remove('hidden');
	qs('#playlistSearch')?.classList.remove('hidden');
	// Ensure playlists are loaded, then render with Liked Songs on top
	(async () => {
		try {
			if (!Array.isArray(allPlaylists) || allPlaylists.length === 0) {
				allPlaylists = await getPlaylists();
			}
			renderPlaylistsWithLiked(allPlaylists);
			playlistSearch.value = '';
			playlistSearch.focus();
		} catch {}
	})();
}

function hidePlaylistSelector() {
	playlistSelector.classList.add('hidden');
	defaultView.classList.remove('hidden');
	qs('.header')?.classList.remove('hidden');
	trackCard?.classList.remove('hidden');
	matchCard?.classList.remove('hidden');
}

function renderPlaylistsWithLiked(playlists) {
	playlistList.innerHTML = '';
	// Liked Songs option first
	const liked = { id: '__liked__', name: 'Liked Songs', images: [{ url: '' }] };
	playlistList.appendChild(createPlaylistItem(liked));
	// Then user playlists
	for (const p of playlists) {
		playlistList.appendChild(createPlaylistItem(p));
	}
}

function filterPlaylists(searchTerm) {
	if (!searchTerm) {
		renderPlaylistsWithLiked(allPlaylists);
		return;
	}
	const filtered = allPlaylists.filter(playlist => playlist.name.toLowerCase().includes(searchTerm.toLowerCase()));
	// Always keep Liked Songs visible when filtering
	renderPlaylistsWithLiked(filtered);
}

function renderPlaylists(playlists) {
	playlistList.innerHTML = '';

	for (const p of playlists) {
		const item = createPlaylistItem(p);
		playlistList.appendChild(item);
	}
}

function applyCoverToElement(el, playlist) {
	el.classList.add('playlist-cover');
	const isLiked = playlist?.id === '__liked__' || (playlist?.name || '').toLowerCase() === 'liked songs';
	if (isLiked) {
		el.style.backgroundImage = `url(icons/likedSongs.jpg)`;
		el.style.backgroundSize = 'cover';
		el.style.backgroundPosition = 'center';
		el.textContent = '';
		return;
	}
	if (playlist?.images?.[0]?.url) {
		el.style.backgroundImage = `url(${playlist.images[0].url})`;
		el.style.backgroundSize = 'cover';
		el.style.backgroundPosition = 'center';
		el.textContent = '';
	} else {
		el.style.backgroundImage = 'none';
		el.style.background = '#535353';
		el.textContent = '';
	}
}

function updateDefaultView(playlist) {
	const defaultPlaylistItem = defaultView.querySelector('.playlist-item');
	const cover = defaultPlaylistItem.querySelector('.playlist-cover') || document.createElement('div');
	applyCoverToElement(cover, playlist);
	if (!cover.parentElement) defaultPlaylistItem.prepend(cover);
	const name = defaultPlaylistItem.querySelector('.playlist-name');
	name.textContent = playlist?.name || 'Liked Songs';
	defaultPlaylistItem.dataset.id = playlist?.id || '__liked__';
}

function createPlaylistItem(playlist) {
	const item = document.createElement('div');
	item.className = 'playlist-item';
	item.dataset.id = playlist.id;
	
	const cover = document.createElement('div');
	applyCoverToElement(cover, playlist);
	
	const info = document.createElement('div');
	info.className = 'playlist-info';
	const nameEl = document.createElement('div');
	nameEl.className = 'playlist-name';
	nameEl.textContent = playlist.name;
	info.appendChild(nameEl);
	item.appendChild(cover);
	item.appendChild(info);
	
	item.addEventListener('click', () => {
		document.querySelectorAll('.playlist-item.selected').forEach(el => el.classList.remove('selected'));
		item.classList.add('selected');
		selectedPlaylistId = playlist.id;
		updateDefaultView(playlist);
		hidePlaylistSelector();
	});
	return item;
}

// Apply liked cover to default tile on init
function applyLikedCoverIfNeeded() {
	const defaultItem = document.querySelector('#defaultView .playlist-item');
	if (!defaultItem) return;
	const cover = defaultItem.querySelector('.playlist-cover') || document.createElement('div');
	cover.className = 'playlist-cover';
	cover.style.backgroundImage = 'url(icons/likedSongs.jpg)';
	cover.style.backgroundSize = 'cover';
	cover.style.backgroundPosition = 'center';
	if (!cover.parentElement) defaultItem.insertBefore(cover, defaultItem.firstChild);
}

function openOnSpotify(uriOrId) {
	try {
		let url = null;
		if (!uriOrId) return;
		if (uriOrId.startsWith('spotify:track:')) {
			const id = uriOrId.split(':').pop();
			url = `https://open.spotify.com/track/${id}`;
		} else if (/^[a-zA-Z0-9]{22}$/.test(uriOrId)) {
			url = `https://open.spotify.com/track/${uriOrId}`;
		}
		if (url) chrome.tabs.create({ url });
	} catch {}
}

// After match is set, wire clickable areas
function wireOpenOnSpotify() {
	const detectedCard = document.getElementById('track');
	const matchCard = document.getElementById('match');
	if (detectedCard) detectedCard.onclick = () => { if (currentMatch?.id) openOnSpotify(currentMatch.id); };
	if (matchCard) matchCard.onclick = () => { if (currentMatch?.id) openOnSpotify(currentMatch.id); };
}

// Helper to set header state consistently
function setHeaderConnected(me) {
	loginBtn?.classList.add('hidden');
	optionsBtn?.classList.remove('hidden');
	if (me?.images?.[0]?.url) {
		userAvatar.src = me.images[0].url;
		userAvatar.classList.remove('hidden');
	}
}

function isSupportedHost(url) {
	try { const host = new URL(url).host; return [
		'youtube.com','youtu.be','music.youtube.com','soundcloud.com','music.apple.com','music.amazon.com','deezer.com','pandora.com','tidal.com','listen.tidal.com','bandcamp.com','open.spotify.com','shazam.com','www.shazam.com'
	].some(s => host.includes(s)); } catch { return false; }
}

(function setPopupContextClass(){
	const isOverlay = !!document.querySelector('.overlay-container iframe, .overlay-container');
	// Heuristic: if running inside an iframe (overlay), add class is-overlay; else is-popup
	try {
		if (window.top !== window.self) document.body.classList.add('is-overlay');
		else document.body.classList.add('is-popup');
	} catch { document.body.classList.add('is-popup'); }
})();

(function initResponsiveContext(){
	// If running as overlay iframe (Shazam), the body has overlay-container. In normal popup, keep default width.
	const isOverlay = !!document.querySelector('.overlay-container');
	if (!isOverlay) {
		const app = document.getElementById('app');
		if (app) { app.style.maxWidth = '420px'; app.style.width = '420px'; }
	}
})();

// Event listeners
selectPlaylistBtn?.addEventListener('click', showPlaylistSelector);

backToDefaultBtn?.addEventListener('click', hidePlaylistSelector);

playlistSearch?.addEventListener('input', (e) => {
	filterPlaylists(e.target.value);
});

createPlaylistBtn?.addEventListener('click', () => {
	// Toggle to create mode
	qs('#createForm')?.classList.remove('hidden');
	qs('#playlistList')?.classList.add('hidden');
	qs('#playlistSearch')?.classList.add('hidden');
	qs('#newPlaylistNameInput')?.focus();
});

qs('#cancelCreateBtn')?.addEventListener('click', () => {
	qs('#createForm')?.classList.add('hidden');
	qs('#playlistList')?.classList.remove('hidden');
	qs('#playlistSearch')?.classList.remove('hidden');
});

qs('#confirmCreateBtn')?.addEventListener('click', async () => {
	const input = qs('#newPlaylistNameInput');
	const name = (input?.value || '').trim();
	if (!name) { setStatus('Enter a playlist name', 'error'); input?.focus(); return; }
	try {
		qs('#confirmCreateBtn').disabled = true;
		qs('#confirmCreateBtn').textContent = 'Creating...';
		const res = await chrome.runtime.sendMessage({ type: 'createPlaylist', payload: { name, trackUri: currentMatch.uri } });
		if (!res?.ok) throw new Error(res?.error || 'Create failed');
		// Reflect selection
		selectedPlaylistId = res.playlistId;
		// Ensure playlists list includes the new one (fetch again minimal cost)
		allPlaylists = await getPlaylists();
		const created = allPlaylists.find(p => p.id === res.playlistId) || { id: res.playlistId, name };
		updateDefaultView(created);
		hidePlaylistSelector();
		setStatus('Created playlist and saved', 'success');
	} catch (e) {
		setStatus('Failed to create playlist: ' + (e?.message || e), 'error');
	} finally {
		qs('#confirmCreateBtn').disabled = false;
		qs('#confirmCreateBtn').textContent = 'Create';
	}
});

saveBtn?.addEventListener('click', async () => {
	try {
		if (!selectedPlaylistId) {
			setStatus('Please select a playlist first', 'error');
			return;
		}
		
		saveBtn.disabled = true;
		saveBtn.textContent = 'Saving...';
		
		if (!currentMatch) return;
		
		if (selectedPlaylistId === '__liked__') {
			await chrome.runtime.sendMessage({ type: 'likeTrack', payload: { trackId: currentMatch.id } });
			setStatus('Saved to Liked Songs', 'success');
			saveBtn.classList.add('success');
			saveBtn.textContent = 'Saved!';
			setTimeout(() => {
				saveBtn.classList.remove('success');
				saveBtn.textContent = 'Save to Spotify';
				saveBtn.disabled = false;
			}, 2000);
			return;
		}
		
		if (selectedPlaylistId === '__create__') {
			const name = newPlaylistName.value.trim();
			if (!name) {
				setStatus('Please enter a playlist name', 'error');
				saveBtn.disabled = false;
				saveBtn.textContent = 'Save to Spotify';
				return;
			}
			await chrome.runtime.sendMessage({ type: 'createPlaylist', payload: { name, trackUri: currentMatch.uri } });
			setStatus('Created playlist and saved', 'success');
			saveBtn.classList.add('success');
			saveBtn.textContent = 'Saved!';
			setTimeout(() => {
				saveBtn.classList.remove('success');
				saveBtn.textContent = 'Save to Spotify';
				saveBtn.disabled = false;
			}, 2000);
			return;
		}
		
		await chrome.runtime.sendMessage({ type: 'addToPlaylist', payload: { playlistId: selectedPlaylistId, trackUri: currentMatch.uri } });
		setStatus('Saved to playlist', 'success');
		saveBtn.classList.add('success');
		saveBtn.textContent = 'Saved!';
		setTimeout(() => {
			saveBtn.classList.remove('success');
			saveBtn.textContent = 'Save to Spotify';
			saveBtn.disabled = false;
		}, 2000);
		
	} catch (e) {
		setStatus('Save failed: ' + (e?.message || e), 'error');
		saveBtn.disabled = false;
		saveBtn.textContent = 'Save to Spotify';
	}
});

loginBtn?.addEventListener('click', async () => {
	try {
		setStatus('Connecting to Spotify...', 'info');
		await ensureAuth();
		setStatus('Spotify connected', 'success');
	} catch (e) {
		setStatus('Auth failed: ' + (e?.message || e), 'error');
		// If missing client ID, open options for user to set it
		if (String(e?.message || e).includes('Missing Spotify Client ID')) {
			try { await chrome.runtime.openOptionsPage(); } catch {}
		}
	}
});

optionsBtn?.addEventListener('click', async () => {
	try { await chrome.runtime.openOptionsPage(); }
	catch {}
});

// Allow clicking the selected default tile to re-open selector
(defaultView?.querySelector('.playlist-item'))?.addEventListener('click', showPlaylistSelector);

// Initialize
(async function init() {
	try {
		applyLikedCoverIfNeeded();
		setStatus('Looking for a song on this page...', 'info');
		const target = await detectTrack();
		await ensureAuth();
		const me = await getMe();
		setHeaderConnected(me);
		
		// Host-aware messaging
		const tab = await getActiveTab();
		const supported = isSupportedHost(tab?.url || '');
		if (!supported) {
			setStatus('This extension works on music streaming sites like YouTube, Spotify, SoundCloud, and Apple Music. Please open a supported site to continue.', 'error');
			return;
		}
		
		if (!target || (!target.title && !target.artist)) {
			setStatus('No audio detected yet. Start playing something and try again.', 'error');
			return;
		}
		
		if (target?.title || target?.artist) {
			trackCard.classList.remove('hidden');
			detectedTitle.textContent = target.title || '';
			detectedArtist.textContent = target.artist || '';
		}
		
		setStatus('Searching match on Spotify...', 'info');
		const matchResult = await searchMatch({ title: target.title, artist: target.artist });
		if (matchResult.noMatch || !matchResult.match) {
			setStatus('No suitable match found. Try a different song or check the spelling.', 'error');
			return;
		}
		
		currentMatch = matchResult.match;
		matchCard.classList.remove('hidden');
		matchTitle.textContent = matchResult.match.name;
		matchArtist.textContent = matchResult.match.artists;
		wireOpenOnSpotify();
		actions.classList.remove('hidden');
		setStatus('Ready to save', 'success');
	} catch (e) {
		setStatus(String(e?.message || e), 'error');
		setHeaderConnected(await getMe());
	}
})();
