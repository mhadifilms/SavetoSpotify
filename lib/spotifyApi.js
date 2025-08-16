export class SpotifyApi {
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

  async getMe() {
    return this._fetch('/me');
  }

  async getUserPlaylists() {
    const items = [];
    let url = '/me/playlists?limit=50';
    while (url) {
      const data = await this._fetch(url.replace(this.base, ''));
      items.push(...data.items.map(p => ({ 
        id: p.id, 
        name: p.name,
        owner: p.owner?.id === data.owner?.id, // true if user owns it
        collaborative: p.collaborative // true if user is collaborator
      }));
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
    return this._fetch(`/me/tracks?ids=${encodeURIComponent(trackId)}`, {
      method: 'PUT'
    });
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
