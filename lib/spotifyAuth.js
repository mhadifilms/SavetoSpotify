function base64UrlEncode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(message) {
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

export class SpotifyAuth {
  constructor({ clientId, redirectUri, scopes }) {
    this.clientId = clientId;
    this.redirectUri = redirectUri;
    this.scopes = scopes || [];
    this.tokenKey = 'spotifyTokens';
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
    const codeChallenge = await sha256(codeVerifier);

    const state = randomString(16);
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', this.scopes.join(' '));

    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });

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
