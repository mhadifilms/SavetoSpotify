const KEY = 'spotifyClientId';
const KEY_SHAZAM = 'enableShazamButton';

function $(id) { return document.getElementById(id); }

async function ensureAuth() {
	try { 
		await chrome.runtime.sendMessage({ type: 'ensureAuth' }); 
		return true; 
	} catch { 
		return false; 
	}
}

async function init() {
	try {
		const redirect = chrome.identity.getRedirectURL('callback');
		$('redirect').textContent = redirect;
		const obj = await chrome.storage.sync.get([KEY, KEY_SHAZAM]);
		if (obj && obj[KEY]) $('clientId').value = obj[KEY];
		$('shazamToggle').checked = obj[KEY_SHAZAM] !== false; // default true
	} catch (e) {
		$('status').textContent = 'Error initializing options: ' + (e?.message || e);
	}
}

$('copyRedirect').addEventListener('click', async () => {
	try {
		await navigator.clipboard.writeText($('redirect').textContent);
		$('status').textContent = '✓ Redirect URI copied to clipboard';
		setTimeout(() => $('status').textContent = '', 2000);
	} catch (e) {
		$('status').textContent = '❌ Failed to copy: ' + (e?.message || e);
		setTimeout(() => $('status').textContent = '', 2000);
	}
});

$('save').addEventListener('click', async () => {
	try {
		const clientId = $('clientId').value.trim();
		if (!clientId) {
			$('status').textContent = '❌ Please enter a Client ID';
			return;
		}
		await chrome.storage.sync.set({ [KEY]: clientId, [KEY_SHAZAM]: $('shazamToggle').checked });
		$('status').textContent = '✓ Settings saved successfully';
		setTimeout(() => $('status').textContent = '', 2000);
	} catch (e) {
		$('status').textContent = '❌ Save failed: ' + (e?.message || e);
		setTimeout(() => $('status').textContent = '', 3000);
	}
});

$('test').addEventListener('click', async () => {
	try {
		$('status').textContent = '🔗 Testing Spotify connection...';
		const ok = await ensureAuth();
		if (ok) {
			$('status').textContent = '✅ Connection successful! You can now use the extension.';
		} else {
			$('status').textContent = '❌ Connection failed. Check your Client ID and try again.';
		}
		setTimeout(() => $('status').textContent = '', 4000);
	} catch (e) {
		$('status').textContent = '❌ Test failed: ' + (e?.message || e);
		setTimeout(() => $('status').textContent = '', 3000);
	}
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);


