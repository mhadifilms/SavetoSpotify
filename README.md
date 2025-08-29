## ![](/icons/icon32.png) Save To Spotify – Chrome Extension

### [Download on the Chrome Web Store](https://chromewebstore.google.com/detail/save-to-spotify/hbonmfkjcjojdiclaifeahldemdhpjln)

Save songs you’re listening to on the web straight to Spotify — either Liked Songs or any of your playlists. You can also create a new playlist on the fly.

Supported: YouTube, YouTube Music, SoundCloud, Apple Music (web), Amazon Music, Deezer, Tidal, Pandora, Bandcamp, Spotify Web Player, and Shazam pages.

### Install (unpacked)
1. Download or clone this repo.
2. Open Chrome → go to `chrome://extensions` → turn on Developer mode.
3. Click “Load unpacked”, select the repo folder (the one with `manifest.json`).
4. Pin the extension for quick access.

### One-time Spotify setup (about 3 minutes)
1. Open the extension’s Options page (right-click the extension → Options).
2. Copy the Redirect URI shown there.
3. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → sign in.
4. Click “Create app” (any name is fine) → open the app.
5. In Settings → “Redirect URIs” → click “Add Redirect URI” → paste the URI from step 2 → Save.
6. From the app Overview copy “Client ID” → paste into the Options page → Save → Test Connection.

Tip: You only need the Client ID; no secret is required (OAuth with PKCE).

### How to use
1. Go to a supported site where a track is visible/playing.
2. Click the extension — it will detect the track and search Spotify.
3. Choose Liked Songs, pick a playlist, or create a new one.
4. Click Save. That’s it.

### Notes
- New playlists are created private by default. You can change visibility in Spotify later.
- Your tokens are stored locally by Chrome and auto‑refreshed. No external servers.
- The extension only runs on music sites to avoid accidental song saves.

---

### Feedback & Contact
Questions or ideas? [Open an issue](https://github.com/mhadifilms/SavetoSpotify/issues) or [start a discussion](https://github.com/mhadifilms/SavetoSpotify/discussions).

### License
This project is licensed under the [MIT License](LICENSE).

