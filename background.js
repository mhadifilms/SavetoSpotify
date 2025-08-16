// Storage keys
const STORAGE_KEYS = {
	CLIENT_ID: 'spotifyClientId',
	TOKENS: 'spotifyTokens'
};

// ---- PKCE Utilities ----
function base64UrlEncode(arrayBuffer) {
	const bytes = new Uint8Array(arrayBuffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64Url(message) {
	const encoder = new TextEncoder();
	const data = encoder.encode(message);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return base64UrlEncode(digest);
}

function randomString(length = 64) {
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, b => ('0' + b.toString(16)).slice(-2)).join('');
}

// ---- SpotifyAuth ----
class SpotifyAuth {
	constructor({ clientId, redirectUri, scopes }) {
		this.clientId = clientId;
		this.redirectUri = redirectUri;
		this.scopes = scopes || [];
		this.tokenKey = STORAGE_KEYS.TOKENS;
	}

	async getStoredTokens() {
		const data = await chrome.storage.local.get(this.tokenKey);
		return data[this.tokenKey] || null;
	}

	async setStoredTokens(tokens) {
		await chrome.storage.local.set({ [this.tokenKey]: tokens });
	}

	async getAccessToken() {
		const tokens = await this.getStoredTokens();
		const now = Math.floor(Date.now() / 1000);
		if (tokens && tokens.access_token && tokens.expires_at && tokens.expires_at - 60 > now) {
			return tokens.access_token;
		}
		if (tokens && tokens.refresh_token) {
			return this.refresh(tokens.refresh_token);
		}
		return this.authorize();
	}

	async authorize() {
		const codeVerifier = randomString(64);
		const codeChallenge = await sha256Base64Url(codeVerifier);
		const state = randomString(16);

		const authUrl = new URL('https://accounts.spotify.com/authorize');
		authUrl.searchParams.set('client_id', this.clientId);
		authUrl.searchParams.set('response_type', 'code');
		authUrl.searchParams.set('redirect_uri', this.redirectUri);
		authUrl.searchParams.set('code_challenge_method', 'S256');
		authUrl.searchParams.set('code_challenge', codeChallenge);
		authUrl.searchParams.set('state', state);
		authUrl.searchParams.set('scope', this.scopes.join(' '));

		const redirectUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
		const url = new URL(redirectUrl);
		const returnedState = url.searchParams.get('state');
		const code = url.searchParams.get('code');
		if (!code || returnedState !== state) throw new Error('Authorization failed or canceled');

		const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: this.clientId,
				grant_type: 'authorization_code',
				code,
				redirect_uri: this.redirectUri,
				code_verifier: codeVerifier
			})
		});
		if (!tokenRes.ok) {
			const text = await tokenRes.text();
			throw new Error('Token exchange failed: ' + text);
		}
		const tokenData = await tokenRes.json();
		const expiresAt = Math.floor(Date.now() / 1000) + (tokenData.expires_in || 3600);
		const stored = {
			access_token: tokenData.access_token,
			refresh_token: tokenData.refresh_token,
			expires_at: expiresAt
		};
		await this.setStoredTokens(stored);
		return stored.access_token;
	}

	async refresh(refreshToken) {
		const res = await fetch('https://accounts.spotify.com/api/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: this.clientId,
				grant_type: 'refresh_token',
				refresh_token: refreshToken
			})
		});
		if (!res.ok) {
			await chrome.storage.local.remove(this.tokenKey);
			return this.authorize();
		}
		const data = await res.json();
		const prev = (await this.getStoredTokens()) || {};
		const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
		const stored = {
			access_token: data.access_token,
			refresh_token: data.refresh_token || prev.refresh_token,
			expires_at: expiresAt
		};
		await this.setStoredTokens(stored);
		return stored.access_token;
	}
}

// ---- SpotifyApi ----
class SpotifyApi {
	constructor({ getAccessToken }) {
		this.getAccessToken = getAccessToken;
		this.base = 'https://api.spotify.com/v1';
	}

	async _fetch(path, options = {}) {
		const token = await this.getAccessToken();
		const res = await fetch(this.base + path, {
			...options,
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				...(options.headers || {})
			}
		});
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Spotify API error ${res.status}: ${text}`);
		}
		if (res.status === 204) return null;
		return res.json();
	}

	async getMe() { return this._fetch('/me'); }

	async getUserPlaylists() {
		const items = [];
		let url = '/me/playlists?limit=50';
		while (url) {
			const data = await this._fetch(url.replace(this.base, ''));
			items.push(...data.items.map(p => ({ id: p.id, name: p.name })));
			url = data.next;
		}
		return items;
	}

	async createPlaylist(name, { isPublic = false } = {}) {
		const me = await this.getMe();
		const data = await this._fetch(`/users/${me.id}/playlists`, {
			method: 'POST',
			body: JSON.stringify({ name, public: !!isPublic })
		});
		return { id: data.id };
	}

	async addTrackToPlaylist(playlistId, trackUri) {
		return this._fetch(`/playlists/${playlistId}/tracks`, {
			method: 'POST',
			body: JSON.stringify({ uris: [trackUri] })
		});
	}

	async likeTrack(trackId) {
		return this._fetch(`/me/tracks?ids=${encodeURIComponent(trackId)}`, { method: 'PUT' });
	}

	async searchTracks(query, { limit = 20 } = {}) {
		const q = encodeURIComponent(query);
		const data = await this._fetch(`/search?type=track&limit=${limit}&q=${q}`);
		const items = (data.tracks?.items || []).map(t => ({
			id: t.id,
			uri: t.uri,
			name: t.name,
			artists: (t.artists || []).map(a => a.name).join(', ')
		}));
		return items;
	}
}

// ---- Matching ----
function normalizeString(s) { return (s || '').toString().toLowerCase().trim(); }
function normalizeForExact(s) {
	s = normalizeString(s);
	s = s.replace(/\[[^\]]*\]/g, '');
	s = s.replace(/\([^\)]*\)/g, '');
	s = s.replace(/[^\w\s]/g, ' ');
	s = s.replace(/\s+/g, ' ').trim();
	return s;
}
function cleanTitleSuffixes(title) {
	const suffixes = [
		' (official audio)', ' (official video)', ' (official music video)',
		' (lyrics)', ' (lyric video)', ' (audio)', ' (video)',
		' (slowed)', ' (sped up)', ' (remix)', ' (lo-fi remix)',
		' (instrumental)', ' (beat)', ' (type beat)', ' (free)',
		' [free]', ' (no copyright music)', ' (no copyright)'
	];
	let t = normalizeString(title);
	for (const s of suffixes) if (t.endsWith(s)) t = t.slice(0, -s.length);
	t = t.replace(/\[[^\]]*\]/g, '').replace(/\([^\)]*\)/g, '').trim();
	return t;
}
function generateSearchVariations({ title, artists }) {
	let t = cleanTitleSuffixes(title || '');
	const artistsStr = (artists || '').split(',')[0].trim();
	const variations = [ `${t} ${artistsStr}`.trim(), `${artistsStr} ${t}`.trim(), t ];
	if (t.includes(' - ')) {
		const segs = t.split(' - ').map(s => s.trim()).filter(Boolean);
		if (segs.length >= 2) {
			const likelyTitle = segs[segs.length - 1];
			const likelyArtist = segs[segs.length - 2];
			variations.push(likelyTitle);
			variations.push(`${likelyTitle} ${likelyArtist}`);
		}
	}
	return Array.from(new Set(variations.filter(Boolean)));
}
function scoreCandidate(target, candidate) {
	let score = 0;
	const ta = cleanTitleSuffixes(target.title);
	const tb = cleanTitleSuffixes(candidate.name);
	if (ta && tb) {
		if (ta === tb) score += 20;
		else if (ta.includes(tb) || tb.includes(ta)) score += (ta.length > 3 && tb.length > 3) ? 5 : 1;
		else {
			const words = ta.split(/\s+/).filter(w => w.length > 3);
			if (words.some(w => tb.includes(w))) score += 1;
		}
		if (normalizeForExact(ta) === normalizeForExact(tb)) score += 10;
	}
	const aa = normalizeString(target.artists);
	const ab = normalizeString(candidate.artists);
	if (aa && ab) {
		if (aa === ab) score += 3;
		else if (aa.includes(ab) || ab.includes(aa)) score += 1;
		else {
			const la = aa.split(',').map(s => s.trim()).filter(Boolean);
			const lb = ab.split(',').map(s => s.trim()).filter(Boolean);
			if (la.some(a => lb.some(b => a && b && (a.includes(b) || b.includes(a))))) score += 1;
		}
	}
	const remixKeywords = ['remix', 'mashup', 'cover', ' x ', ' × '];
	if (remixKeywords.some(k => tb.includes(k))) score -= 3;
	if (tb.includes(' feat ') || tb.includes(' ft ')) score -= 1;
	if ((ta === tb || ta.includes(tb) || tb.includes(ta)) && aa && ab) {
		const la = aa.split(',').map(s => s.trim()).filter(Boolean);
		const lb = ab.split(',').map(s => s.trim()).filter(Boolean);
		const artistMatch = la.some(a => lb.some(b => a && b && (a.includes(b) || b.includes(a))));
		if (!artistMatch) score -= 3; else score += 5;
	}
	return score;
}
async function searchBestMatch(api, target) {
	const variations = generateSearchVariations(target);
	let best = null; let bestScore = -1;
	for (const q of variations) {
		try {
			const candidates = await api.searchTracks(q, { limit: 20 });
			for (const c of candidates) {
				const s = scoreCandidate(target, c);
				if (s > bestScore) { best = c; bestScore = s; }
			}
		} catch {}
	}
	if (!best || bestScore <= 0) {
		const cleaned = cleanTitleSuffixes(target.title || '');
		try {
			const candidates = await api.searchTracks(cleaned, { limit: 50 });
			for (const c of candidates) {
				const s = scoreCandidate(target, c);
				if (s > bestScore) { best = c; bestScore = s; }
			}
		} catch {}
	}
	return best ? { ...best, score: bestScore } : null;
}

// ---- Helpers ----
async function getClientId() {
	const { [STORAGE_KEYS.CLIENT_ID]: clientId } = await chrome.storage.sync.get(STORAGE_KEYS.CLIENT_ID);
	if (!clientId) throw new Error('Missing Spotify Client ID. Open Options to set it.');
	return clientId;
}

async function getAuth() {
	const clientId = await getClientId();
	const redirectUri = chrome.identity.getRedirectURL('callback');
	const scopes = [
		'user-library-modify',
		'playlist-modify-private',
		'playlist-modify-public',
		'playlist-read-private'
	];
	return new SpotifyAuth({ clientId, redirectUri, scopes });
}

async function getApi() {
	const auth = await getAuth();
	await auth.getAccessToken();
	return new SpotifyApi({ getAccessToken: () => auth.getAccessToken() });
}

// ---- Message Router ----
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	(async () => {
		try {
			switch (message.type) {
				case 'ensureAuth': {
					const auth = await getAuth();
					await auth.getAccessToken();
					sendResponse({ ok: true });
					break;
				}
				case 'getMe': {
					const api = await getApi();
					const me = await api.getMe();
					sendResponse({ ok: true, me });
					break;
				}
				case 'searchAndMatch': {
					const api = await getApi();
					const match = await searchBestMatch(api, {
						title: message.payload?.title || '',
						artists: message.payload?.artist || ''
					});
					sendResponse({ ok: true, match });
					break;
				}
				case 'getPlaylists': {
					const api = await getApi();
					const playlists = await api.getUserPlaylists();
					// Filter to only show playlists user owns or collaborates on
					const filteredPlaylists = playlists.filter(p => p.owner || p.collaborative);
					filteredPlaylists.sort((a, b) => a.name.localeCompare(b.name));
					sendResponse({ ok: true, playlists: filteredPlaylists });
					break;
				}
				case 'addToPlaylist': {
					const api = await getApi();
					await api.addTrackToPlaylist(message.payload.playlistId, message.payload.trackUri);
					sendResponse({ ok: true });
					break;
				}
				case 'createPlaylist': {
					const api = await getApi();
					// Unlisted-style: not shown on profile, shareable by link
					const { id } = await api.createPlaylist(message.payload.name, { isPublic: false });
					await api.addTrackToPlaylist(id, message.payload.trackUri);
					sendResponse({ ok: true, playlistId: id });
					break;
				}
				case 'likeTrack': {
					const api = await getApi();
					await api.likeTrack(message.payload.trackId);
					sendResponse({ ok: true });
					break;
				}
				default:
					sendResponse({ ok: false, error: 'Unknown message type' });
			}
		} catch (err) {
			sendResponse({ ok: false, error: String(err?.message || err) });
		}
	})();
	return true; // keep channel open
});
