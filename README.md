## ![](/icons/icon32.png) Save To Spotify – Chrome Extension

[Download on the Chrome Web Store](https://chromewebstore.google.com/detail/save-to-spotify/hbonmfkjcjojdiclaifeahldemdhpjln)

Save the currently focused song from major streaming sites to your Spotify account (Liked Songs or any playlist; create a new one too).

Supported sites: YouTube, YouTube Music, SoundCloud, Apple Music (web), Amazon Music, Deezer, Tidal, Pandora, Bandcamp, Spotify Web Player. Uses Media Session API where available as a fallback.

### Install
1) Download/clone this repo.
2) Open Chrome → `chrome://extensions` → enable Developer mode.
3) Click "Load unpacked" and select this repo folder (the folder containing `manifest.json`).

### One-time setup (Spotify, takes ~3 minutes)
1) Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications).
2) Open the extension’s Options page and copy the shown Redirect URI.
3) In your Spotify app settings, add that Redirect URI.
4) Paste your Spotify Client ID into the Options page and save.

### Usage
1) Go to a supported site with a track visible/playing.
2) Click the extension → it detects the song → searches Spotify.
3) If found, pick a playlist, choose Liked Songs, or select "Create new playlist…" to name a new one.
4) Save. The track is added to your Spotify account.

Notes:
- New playlists are created unlisted-style: not shown on profile (private in Spotify terms). You can share via link from Spotify if desired.
- Tokens are stored locally and auto-refreshed. No server needed.
- If detection fails for a site, it will attempt Media Session or fall back to the tab title.

### Icons

Place your extension icons under `icons/` with names `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`.
