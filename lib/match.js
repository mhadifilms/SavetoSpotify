function normalizeString(s) {
  if (!s) return '';
  return String(s).toLowerCase().trim();
}

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
  for (const s of suffixes) {
    if (t.endsWith(s)) t = t.slice(0, -s.length);
  }
  t = t.replace(/\[[^\]]*\]/g, '').replace(/\([^\)]*\)/g, '').trim();
  return t;
}

function generateSearchVariations({ title, artists }) {
  let t = cleanTitleSuffixes(title || '');
  const artistsStr = (artists || '').split(',')[0].trim();
  const variations = [
    `${t} ${artistsStr}`.trim(),
    `${artistsStr} ${t}`.trim(),
    t
  ];
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
    else if (ta.includes(tb) || tb.includes(ta)) {
      if (ta.length > 3 && tb.length > 3) score += 5; else score += 1;
    } else {
      const words = ta.split(/\s+/).filter(w => w.length > 3);
      if (words.some(w => tb.includes(w))) score += 1;
    }
    if (normalizeForExact(ta) && normalizeForExact(ta) === normalizeForExact(tb)) score += 10;
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

export async function searchBestMatch(api, { title, artists }) {
	if (!title && !artists) return null;
	const query = [title, artists].filter(Boolean).join(' ');
	const results = await api.searchTracks(query, 10);
	if (!results || results.length === 0) return null;
	
	function normalize(s){ return (s||'').toLowerCase().trim(); }
	function stripTrackNo(s){ return normalize(s).replace(/^\d+\s*[-–]\s*/,''); }
	const normTitle = stripTrackNo(title);
	const normArtists = normalize(artists);
	
	const scored = results.map(track => {
		let score = 0;
		const tName = stripTrackNo(track.name);
		if (normTitle && tName) {
			if (normTitle === tName) score += 20;
			else if (tName.includes(normTitle) || normTitle.includes(tName)) score += 10;
			else {
				const words = normTitle.split(/\s+/).filter(w=>w.length>3);
				if (words.some(w=>tName.includes(w))) score += 4;
			}
			// Penalize different variation numbers (e.g., Variation 2 vs Variation 3)
			const varRe = /variation\s*(\d+)/i;
			const aVar = varRe.exec(normTitle)?.[1];
			const bVar = varRe.exec(tName)?.[1];
			if (aVar && bVar && aVar !== bVar) score -= 6;
		}
		if (normArtists && track.artists) {
			const tArtists = normalize(track.artists);
			if (tArtists === normArtists) score += 8;
			else if (tArtists.includes(normArtists) || normArtists.includes(tArtists)) score += 5;
		}
		if (track.popularity) score += Math.floor(track.popularity/10);
		return { ...track, score };
	});
	const good = scored.filter(t => t.score >= 5).sort((a,b)=>b.score-a.score);
	return good[0] || null;
}
