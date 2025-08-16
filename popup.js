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
const playlistSelect = qs('#playlistSelect');
const playlistSearch = qs('#playlistSearch');
const newPlaylistName = qs('#newPlaylistName');
const saveBtn = qs('#saveBtn');

let currentMatch = null;
let allPlaylists = [];

function setStatus(text) { statusEl.textContent = text; }

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
	return res.match;
}

async function getPlaylists() {
	const res = await chrome.runtime.sendMessage({ type: 'getPlaylists' });
	if (!res?.ok) throw new Error(res?.error || 'Playlists failed');
	return res.playlists;
}

async function getMe() {
	try {
		const res = await chrome.runtime.sendMessage({ type: 'getMe' });
		if (!res?.ok) return null;
		return res.me;
	} catch { return null; }
}

function filterPlaylists(searchTerm) {
	if (!searchTerm) {
		fillPlaylists(allPlaylists);
		return;
	}
	
	const filtered = allPlaylists.filter(playlist => 
		playlist.name.toLowerCase().includes(searchTerm.toLowerCase())
	);
	fillPlaylists(filtered);
	
	// Show search feedback
	if (filtered.length === 0) {
		setStatus(`🔍 No playlists found matching "${searchTerm}"`);
	} else if (filtered.length < allPlaylists.length) {
		setStatus(`🔍 Found ${filtered.length} playlist${filtered.length === 1 ? '' : 's'} matching "${searchTerm}"`);
	}
}

function fillPlaylists(playlists) {
	playlistSelect.innerHTML = '';
	
	// Add Liked Songs first
	const liked = document.createElement('option');
	liked.value = '__liked__';
	liked.textContent = '❤️ Liked Songs';
	playlistSelect.appendChild(liked);

	// Add playlists
	for (const p of playlists) {
		const opt = document.createElement('option');
		opt.value = p.id;
		opt.textContent = p.name;
		playlistSelect.appendChild(opt);
	}

	// Add create new option
	const create = document.createElement('option');
	create.value = '__create__';
	create.textContent = '➕ Create new playlist…';
	playlistSelect.appendChild(create);
}

// Event listeners
playlistSearch?.addEventListener('input', (e) => {
	filterPlaylists(e.target.value);
});

playlistSelect?.addEventListener('change', () => {
	if (playlistSelect.value === '__create__') {
		newPlaylistName.classList.remove('hidden');
		newPlaylistName.focus();
	} else {
		newPlaylistName.classList.add('hidden');
	}
});

saveBtn?.addEventListener('click', async () => {
	try {
		saveBtn.disabled = true;
		saveBtn.textContent = 'Saving...';
		
		if (!currentMatch) return;
		
		const choice = playlistSelect.value;
		if (choice === '__liked__') {
			await chrome.runtime.sendMessage({ type: 'likeTrack', payload: { trackId: currentMatch.id } });
			setStatus('✓ Saved to Liked Songs');
			return;
		}
		if (choice === '__create__') {
			const name = newPlaylistName.value.trim();
			if (!name) throw new Error('Enter a playlist name');
			await chrome.runtime.sendMessage({ type: 'createPlaylist', payload: { name, trackUri: currentMatch.uri } });
			setStatus('✓ Created playlist and saved');
			return;
		}
		if (choice) {
			await chrome.runtime.sendMessage({ type: 'addToPlaylist', payload: { playlistId: choice, trackUri: currentMatch.uri } });
			setStatus('✓ Saved to playlist');
			return;
		}
	} catch (e) {
		setStatus('❌ Save failed: ' + (e?.message || e));
	} finally {
		saveBtn.disabled = false;
		saveBtn.textContent = 'Save to Spotify';
	}
});

loginBtn?.addEventListener('click', async () => {
	try {
		setStatus('🔍 Connecting to Spotify…');
		await ensureAuth();
		setStatus('✓ Spotify connected');
	} catch (e) {
		setStatus('❌ Auth failed: ' + (e?.message || e));
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

// Initialize
(async function init() {
	try {
		setStatus('🔍 Detecting song…');
		const target = await detectTrack();
		
		// Check if we're on a supported site and detected a song
		if (!target) {
			setStatus('❌ This extension only works on music streaming sites like YouTube, Spotify, SoundCloud, Apple Music, etc. Please navigate to a supported site.');
			return;
		}
		
		if (!target.title && !target.artist) {
			setStatus('❌ No music detected on this page. This extension works on music streaming sites like YouTube, Spotify, SoundCloud, Apple Music, etc.');
			return;
		}
		
		if (target?.title || target?.artist) {
			trackCard.classList.remove('hidden');
			detectedTitle.textContent = target.title || '';
			detectedArtist.textContent = target.artist || '';
		}
		
		setStatus('🔗 Connecting to Spotify…');
		await ensureAuth();
		
		// Show connected UI
		loginBtn?.classList.add('hidden');
		optionsBtn?.classList.remove('hidden');
		
		const me = await getMe();
		if (me?.images?.[0]?.url) {
			userAvatar.src = me.images[0].url;
			userAvatar.classList.remove('hidden');
		}
		
		setStatus('🎵 Searching match on Spotify…');
		const match = await searchMatch({ title: target.title, artist: target.artist });
		if (!match) { 
			setStatus('❌ No Spotify match found'); 
			return; 
		}
		
		currentMatch = match;
		matchCard.classList.remove('hidden');
		matchTitle.textContent = match.name;
		matchArtist.textContent = match.artists;
		
		setStatus('📚 Loading playlists…');
		allPlaylists = await getPlaylists();
		fillPlaylists(allPlaylists);
		actions.classList.remove('hidden');
		
		setStatus('✅ Ready to save');
	} catch (e) {
		setStatus('❌ ' + String(e?.message || e));
		// When not authenticated yet:
		loginBtn?.classList.remove('hidden');
		optionsBtn?.classList.add('hidden');
	}
})();
