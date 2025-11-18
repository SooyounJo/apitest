import { hexToRgb, rgbToHsl, hslToRgb, rgbToHsv, adjustLightingHex } from '../../prompts/color';

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST']);
		return res.status(405).json({ message: 'Method Not Allowed' });
	}

	const apiKey = process.env.OPENAI_API_KEY;
	const baseUrl =
		process.env.OPENAI_BASE_URL?.replace(/\/+$/, '') || 'https://api.openai.com/v1';

	if (!apiKey) {
		return res
			.status(500)
			.json({ message: 'Missing OPENAI_API_KEY in environment' });
	}

	try {
		const { model, system, prompt } = req.body || {};
		if (!model || !prompt) {
			return res.status(400).json({
				message: 'Both "model" and "prompt" fields are required'
			});
		}

		let extraContext = null;

		const messages = [
			system ? { role: 'system', content: String(system) } : null,
			extraContext ? { role: 'system', content: extraContext } : null,
			{ role: 'user', content: String(prompt) }
		].filter(Boolean);

		const payload = {
			model,
			messages,
			response_format: { type: 'json_object' }
		};

		const response = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			const errorPayload = await safeJson(response);
			const message =
				errorPayload?.error?.message ||
				errorPayload?.message ||
				`Upstream error (${response.status})`;
			return res.status(response.status).json({ message });
		}

		const data = await response.json();
		let output =
			data?.choices?.[0]?.message?.content ??
			data?.choices?.[0]?.text ??
			'';
		const usage = data?.usage
			? {
					prompt_tokens: data.usage.prompt_tokens,
					completion_tokens: data.usage.completion_tokens,
					total_tokens: data.usage.total_tokens
			  }
			: null;

		// Pass-through model JSON; only pretty-print if parsable. Disable server-side repairs for now.
		try {
			const parsed = JSON.parse(output);
			output = JSON.stringify(parsed, null, 2);
		} catch {}

		return res.status(200).json({ output, usage, raw: data });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return res.status(500).json({ message });
	}
}

async function safeJson(response) {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

// ---------- Helpers for enforcing environment fields ----------
const TEMPS = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
const HUMIDS = [30, 35, 40, 45, 50, 55, 60, 65, 70];
const BRIGHT = [1, 2, 3, 4, 5];
const MUSIC_LIST = [
	'Life is - Scott Burkely',
	'Glow - Scott Burkely',
	'Clean Soul - Kevin MacLeod',
	'Borealis - Scott Burkely',
	'Solstice - Scott Burkely',
	'New Beginnings - Tokyo Music Walker',
	'Solace - Scott Burkely',
	'The Travelling Symphony - Savfk',
	'331Music - Happy Stroll',
	'Derek Fiechter & Brandon Fiechter - Ukulele Dance',
	'Kevin MacLeod - Happy Alley',
	'Sunny Side Up - Victor Lundberg',
	'Amberlight - Scott Burkely',
	'Shoulders Of Giants - Scott Burkely',
	'Echoes - Scott Burkely',
	'A Kind Of Hope - Scott Burkely'
];

function hashStr(s) {
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = (h * 31 + s.charCodeAt(i)) % 2147483647;
	}
	return h >>> 0;
}

function chooseFrom(candidates, seedText) {
	if (!Array.isArray(candidates) || candidates.length === 0) return 'Life is - Scott Burkely';
	const idx = hashStr(seedText || '') % candidates.length;
	return candidates[idx];
}

function chooseMusicByEmotion(emotion, userPrompt) {
	const e = String(emotion || '').trim();
	// 그룹 정의
	const groups = [
		{
			match: ['기쁨', '감격', '설렘', '경쾌', '기대', '행복', '만족', '흥분', '활력', '충족감'],
			list: ['331Music - Happy Stroll', 'Kevin MacLeod - Happy Alley', 'Sunny Side Up - Victor Lundberg']
		},
		{
			match: ['분노', '짜증', '경계', '긴장', '당혹'],
			list: ['Amberlight - Scott Burkely', 'The Travelling Symphony - Savfk', 'Shoulders Of Giants - Scott Burkely']
		},
		{
			match: ['무기력', '피로', '번아웃', '소진', '허무', '음울', '가라앉음', '공허'],
			list: ['Solace - Scott Burkely', 'New Beginnings - Tokyo Music Walker', 'A Kind Of Hope - Scott Burkely']
		},
		{
			match: ['평온', '편안', '안정감', '담담', '잔잔함', '고요함', '조용함', '완화', '여유'],
			list: ['Life is - Scott Burkely', 'Glow - Scott Burkely', 'Clean Soul - Kevin MacLeod']
		},
		{
			match: ['고독', '향수', '체념', '두려움'],
			list: ['Solstice - Scott Burkely', 'Borealis - Scott Burkely', 'Echoes - Scott Burkely']
		},
		{
			match: ['갈증', '성공', '회복', '위안'],
			list: ['Shoulders Of Giants - Scott Burkely', 'Echoes - Scott Burkely']
		},
		{
			match: ['포근함', '온기', '느긋'],
			list: ['Derek Fiechter & Brandon Fiechter - Ukulele Dance', 'Life is - Scott Burkely']
		}
	];
	for (const g of groups) {
		if (g.match.includes(e)) {
			return chooseFrom(g.list, userPrompt || e);
		}
	}
	// 기본값
	return chooseFrom(['Life is - Scott Burkely', 'Clean Soul - Kevin MacLeod', 'Glow - Scott Burkely'], userPrompt || e);
}

function clampToAllowed(val, allowed, defVal) {
	if (typeof val === 'number' && allowed.includes(Math.round(val))) {
		return Math.round(val);
	}
	const parsed = Number(String(val).replace(/[^\d.]/g, ''));
	if (Number.isFinite(parsed) && allowed.includes(Math.round(parsed))) {
		return Math.round(parsed);
	}
	return defVal;
}

function chooseNearestAllowed(allowed, target, defVal) {
	if (!Array.isArray(allowed) || allowed.length === 0) return defVal;
	let best = allowed[0];
	let bestDelta = Math.abs(best - target);
	for (const v of allowed) {
		const d = Math.abs(v - target);
		if (d < bestDelta) {
			best = v;
			bestDelta = d;
		}
	}
	return best;
}

function thermalCueFromText(text) {
	const t = String(text || '').toLowerCase();
	// cold cues
	if (/(추워|춥|cold|chilly|freez|한기|시려)/.test(t)) return 'cold';
	// hot cues
	if (/(더워|덥|hot|heat|뜨거|무더)/.test(t)) return 'hot';
	return null;
}

function parseComfortCues(text) {
	const t = String(text || '').toLowerCase();
	const has = (re) => re.test(t);
	return {
		cold: has(/(추워|춥|cold|chilly|freez|한기|시려)/),
		hot: has(/(더워|덥|hot|heat|뜨거|무더)/),
		dry: has(/(건조|dry|dehydrated|static)/),
		humid: has(/(습해|습함|끈적|sticky|humid|muggy)/),
		stuffy: has(/(답답|stuffy|stifling|환기|airless)/),
		bright: has(/(눈부셔|밝아|too bright|glare)/),
		dim: has(/(어두워|dim|dark)/),
		sleepy: has(/(졸려|sleepy|drowsy|피곤|나른)/),
		focus: has(/(집중|focus|study|work)/)
	};
}

function ensureEnvironmentFields(obj, userPrompt) {
	// If new schema is detected, enforce and auto-fill its fields
	if (
		obj &&
		typeof obj === 'object' &&
		(
			'temperature_celsius' in obj ||
			'humidity_percent' in obj ||
			'music_title' in obj ||
			'music_artist' in obj ||
			'lighting_mode' in obj ||
			'lighting_rgb' in obj ||
			'lighting_r' in obj ||
			'lighting_g' in obj ||
			'lighting_b' in obj ||
			'lighting_kelvin' in obj ||
			'lighting_color_temp' in obj ||
			'lighting_hue' in obj ||
			'lighting_saturation' in obj ||
			'lighting_brightness_254' in obj
		)
	) {
		return ensureNewSchemaFields(obj, userPrompt);
	}

	const payload = { ...obj };
	let repaired = false;
	// emotion/hex should exist already; if not, leave for frontend

	// temperature
	if (payload.temperature_c === undefined) {
		payload.temperature_c = 21;
		repaired = true;
	} else {
		const v = clampToAllowed(payload.temperature_c, TEMPS, 21);
		if (v !== payload.temperature_c) repaired = true;
		payload.temperature_c = v;
	}
	// humidity
	if (payload.humidity_pct === undefined) {
		payload.humidity_pct = 50;
		repaired = true;
	} else {
		const v = clampToAllowed(payload.humidity_pct, HUMIDS, 50);
		if (v !== payload.humidity_pct) repaired = true;
		payload.humidity_pct = v;
	}
	// brightness
	if (payload.brightness_level === undefined) {
		payload.brightness_level = 3;
		repaired = true;
	} else {
		const v = clampToAllowed(payload.brightness_level, BRIGHT, 3);
		if (v !== payload.brightness_level) repaired = true;
		payload.brightness_level = v;
	}
	// music
	if (payload.music === undefined || !MUSIC_LIST.includes(String(payload.music))) {
		payload.music = chooseMusicByEmotion(payload.emotion, userPrompt);
		if (!MUSIC_LIST.includes(String(payload.music))) {
			payload.music = 'Life is - Scott Burkely';
		}
		repaired = true;
	}

	// Adjust for explicit thermal cue in the user's prompt
	const cue = thermalCueFromText(userPrompt);
	if (cue === 'cold') {
		const warmTemp = chooseNearestAllowed(TEMPS, 25, 25);
		const warmHumid = chooseNearestAllowed(HUMIDS, 52, 50);
		if (payload.temperature_c < warmTemp) {
			payload.temperature_c = warmTemp;
			repaired = true;
		}
		if (payload.humidity_pct < warmHumid) {
			payload.humidity_pct = warmHumid;
			repaired = true;
		}
		if (payload.brightness_level < 2) {
			payload.brightness_level = 2;
			repaired = true;
		}
		// warm up lighting tone slightly
		if (payload.hex || payload.lighting_color_hex) {
			const base = payload.lighting_color_hex || payload.hex;
			payload.lighting_color_hex = adjustLightingHex(base, { warm: 1, brighten: 0.06 });
			repaired = true;
		}
	} else if (cue === 'hot') {
		const coolTemp = chooseNearestAllowed(TEMPS, 20, 20);
		const drier = chooseNearestAllowed(HUMIDS, 43, 45);
		if (payload.temperature_c > coolTemp) {
			payload.temperature_c = coolTemp;
			repaired = true;
		}
		if (payload.humidity_pct > drier) {
			payload.humidity_pct = drier;
			repaired = true;
		}
		if (payload.brightness_level < 3) {
			// keep or raise brightness slightly when hot to feel airy
			payload.brightness_level = 3;
			repaired = true;
		}
		// cool and brighten the lighting tone
		if (payload.hex || payload.lighting_color_hex) {
			const base = payload.lighting_color_hex || payload.hex;
			payload.lighting_color_hex = adjustLightingHex(base, { cool: 1, brighten: 0.08 });
			repaired = true;
		}
	}

	// Rich comfort cues (dry/humid/stuffy/brightness/etc.)
	const cues = parseComfortCues(userPrompt);
	if (cues.dry) {
		const targetHumid = chooseNearestAllowed(HUMIDS, 55, 55);
		if (payload.humidity_pct < targetHumid) {
			payload.humidity_pct = targetHumid;
			repaired = true;
		}
		// slightly warm for dry air
		if (payload.hex || payload.lighting_color_hex) {
			const base = payload.lighting_color_hex || payload.hex;
			payload.lighting_color_hex = adjustLightingHex(base, { warm: 0.6, brighten: 0.04 });
			repaired = true;
		}
	}
	if (cues.humid) {
		const targetHumid = chooseNearestAllowed(HUMIDS, 40, 40);
		if (payload.humidity_pct > targetHumid) {
			payload.humidity_pct = targetHumid;
			repaired = true;
		}
		// cooler to feel fresher
		if (payload.hex || payload.lighting_color_hex) {
			const base = payload.lighting_color_hex || payload.hex;
			payload.lighting_color_hex = adjustLightingHex(base, { cool: 0.8, brighten: 0.06 });
			repaired = true;
		}
	}
	if (cues.stuffy) {
		const coolTemp = chooseNearestAllowed(TEMPS, 20, 20);
		const drier = chooseNearestAllowed(HUMIDS, 43, 45);
		if (payload.temperature_c > coolTemp) {
			payload.temperature_c = coolTemp;
			repaired = true;
		}
		if (payload.humidity_pct > drier) {
			payload.humidity_pct = drier;
			repaired = true;
		}
		if (payload.brightness_level < 3) {
			payload.brightness_level = 3;
			repaired = true;
		}
		if (payload.hex || payload.lighting_color_hex) {
			const base = payload.lighting_color_hex || payload.hex;
			payload.lighting_color_hex = adjustLightingHex(base, { cool: 1, brighten: 0.08 });
			repaired = true;
		}
	}
	if (cues.bright && payload.brightness_level > 2) {
		payload.brightness_level = 2;
		repaired = true;
	}
	if (cues.dim && payload.brightness_level < 4) {
		payload.brightness_level = 4;
		repaired = true;
	}
	if (cues.sleepy) {
		// help relaxation: slightly warmer and more humid if low
		const warmTemp = chooseNearestAllowed(TEMPS, 23, 23);
		const comfyHumid = chooseNearestAllowed(HUMIDS, 50, 50);
		if (payload.temperature_c < warmTemp) {
			payload.temperature_c = warmTemp;
			repaired = true;
		}
		if (payload.humidity_pct < comfyHumid) {
			payload.humidity_pct = comfyHumid;
			repaired = true;
		}
		if (payload.brightness_level > 2) {
			payload.brightness_level = 2;
			repaired = true;
		}
		// prefer a calm track if defaulted
		if (!MUSIC_LIST.includes(payload.music)) {
			payload.music = 'New Beginnings - Tokyo Music Walker';
			repaired = true;
		}
		if (payload.hex || payload.lighting_color_hex) {
			const base = payload.lighting_color_hex || payload.hex;
			payload.lighting_color_hex = adjustLightingHex(base, { warm: 0.6, brighten: -0.02 });
			repaired = true;
		}
	}
	if (cues.focus) {
		if (payload.brightness_level < 3) {
			payload.brightness_level = 3;
			repaired = true;
		}
		// keep temp neutral and humidity mid-range
		const neutralTemp = chooseNearestAllowed(TEMPS, 21, 21);
		const neutralHumid = chooseNearestAllowed(HUMIDS, 45, 45);
		payload.temperature_c = neutralTemp;
		payload.humidity_pct = neutralHumid;
		if (payload.hex || payload.lighting_color_hex) {
			const base = payload.lighting_color_hex || payload.hex;
			payload.lighting_color_hex = adjustLightingHex(base, { cool: 0.4, brighten: 0.02 });
			repaired = true;
		}
	}
	return { payload, repaired };
}

// Color utilities are now centralized in ../../lib/color

function clamp(v, min, max) {
	if (!Number.isFinite(v)) return min;
	return Math.max(min, Math.min(max, v));
}

function deriveEmotionRgbFromHex(baseHex, quadrant) {
	try {
		const hex = typeof baseHex === 'string' && baseHex ? baseHex : '#FFFFFF';
		const { r, g, b } = hexToRgb(hex);
		let { h, s, l } = rgbToHsl(r, g, b);
		const isNeg = quadrant === 'neg_active' || quadrant === 'neg_passive';
		if (isNeg) h = (h + 180) % 360;
		const out = hslToRgb(h, s, l);
		return { r: Math.round(out.r), g: Math.round(out.g), b: Math.round(out.b) };
	} catch {
		return { r: 220, g: 200, b: 180 };
	}
}

// kelvinToRgb was removed as we now derive RGB from the emotion color/complement rule

// ---------- New-schema enforcement (temperature_celsius, humidity_percent, music_title/artist, lighting_* ) ----------
const QUADRANT_TARGETS = {
	'pos_active': { temp: 22.5, humid: 57.5, mode: 'rgb', rgb: [255, 220, 180], kelvin: 3500, brightness: 90 },
	'pos_passive': { temp: 26.0, humid: 57.5, mode: 'temp', kelvin: 3000, brightness: 45 },
	'neg_active': { temp: 21.0, humid: 37.5, mode: 'temp', kelvin: 4000, brightness: 50 },
	'neg_passive': { temp: 25.5, humid: 37.5, mode: 'temp', kelvin: 3000, brightness: 80 },
	'default': { temp: 24.0, humid: 50.0, mode: 'temp', kelvin: 3500, brightness: 50 }
};

const MUSIC_LIBRARY_BY_QUADRANT = {
	'pos_passive': [
		{ title: 'life is', artist: 'Scott Buckley' },
		{ title: 'Glow', artist: 'Scott Buckley' },
		{ title: 'Clean Soul - Calming', artist: 'Kevin MacLeod' },
		{ title: 'Solace', artist: 'Scott Buckley' }
	],
	'pos_active': [
		{ title: 'happy stroll', artist: '331music' },
		{ title: 'Ukulele Dance', artist: 'Derek Fiechter & Brandon Fiechter' },
		{ title: 'Happy Alley', artist: 'Kevin MacLeod' },
		{ title: 'sunny side up', artist: 'Victor Lundberg' }
	],
	'neg_passive': [
		{ title: 'solstice', artist: 'Scott Buckley' },
		{ title: 'Amberlight', artist: 'Scott Buckley' },
		{ title: 'Borealis', artist: 'Scott Buckley' },
		{ title: 'A Kind Of Hope', artist: 'Scott Buckley' }
	],
	'neg_active': [
		{ title: 'New Beginnings', artist: 'Tokyo Music Walker' },
		{ title: 'the travelling symphony', artist: 'Savfk' },
		{ title: 'Echoes', artist: 'Scott Buckley' },
		{ title: 'Shoulders Of Giants', artist: 'Scott Buckley' }
	]
};

function quadrantForEmotion(emotion) {
	const e = String(emotion || '').trim();
	if (!e) return 'default';
	const posActive = ['놀라움', '흥분', '설렘', '활력', '흥미', '감격', '기쁨', '기대', '몰입', '집중', '회복', '자각', '도취', '영감', '호기심', '상쾌함', '기대감', '산뜻함', '뿌듯함', '기력회복', '청량', '명료', '맑음', '경쾌', '발돋움', '포커스', '자기확신'];
	if (posActive.includes(e)) return 'pos_active';
	const posPassive = ['고독', '만족', '느긋', '평온', '편안', '애틋함', '향수', '아득함', '해갈감', '충만함', '위안', '고요함', '침착함', '균형감', '온화함', '차분함', '무심함', '감상', '진정', '여유', '꿈결', '몽환', '미온', '관조', '평정심', '포용', '충족감', '해소', '편유', '조용함', '온기', '담담', '완화', '설원감', '은은함', '잔잔함'];
	if (posPassive.includes(e)) return 'pos_passive';
	const negActive = ['충격', '당혹', '분노', '짜증', '경계', '긴장', '갈증'];
	if (negActive.includes(e)) return 'neg_active';
	const negPassive = ['번아웃', '피로', '실망', '후회', '무력', '공허', '심심함', '수줍음', '체념', '서늘함', '흐릿함', '음울', '회피', '무기력', '흐트러짐', '무심함 ', '희미함', '가라앉음', '소진', '억눌림', '허무', '회한', '두려움', '고독', '향수'];
	if (negPassive.includes(e)) return 'neg_passive';
	return 'default';
}

function chooseMusicForQuadrant(quadrant, seed) {
	const list = MUSIC_LIBRARY_BY_QUADRANT[quadrant] || MUSIC_LIBRARY_BY_QUADRANT['pos_passive'];
	const idx = hashStr(seed || '') % list.length;
	return list[idx];
}

function ensureNewSchemaFields(obj, userPrompt) {
	const p = { ...obj };
	let repaired = false;

	// Quadrant selection for targets
	const q = quadrantForEmotion(p.emotion);
	const targets = QUADRANT_TARGETS[q] || QUADRANT_TARGETS['default'];

	// Temperature / humidity
	if (typeof p.temperature_celsius !== 'number') {
		p.temperature_celsius = targets.temp;
		repaired = true;
	}
	if (typeof p.humidity_percent !== 'number') {
		p.humidity_percent = targets.humid;
		repaired = true;
	}

	// Music
	if (!p.music_title || !p.music_artist) {
		const pick = chooseMusicForQuadrant(q, (userPrompt || '') + (p.emotion || ''));
		p.music_title = pick.title;
		p.music_artist = pick.artist;
		repaired = true;
	}

	// Lighting
	const mode = String(p.lighting_mode || targets.mode || 'temp').toLowerCase();
	p.lighting_mode = mode === 'rgb' || mode === 'temp' ? mode : 'temp';
	const emotionRgb = deriveEmotionRgbFromHex(p.hex, q);

	if (p.lighting_mode === 'rgb') {
		// Force rule: positive -> emotion color, negative -> complementary
		p.lighting_r = clamp(emotionRgb.r, 0, 255);
		p.lighting_g = clamp(emotionRgb.g, 0, 255);
		p.lighting_b = clamp(emotionRgb.b, 0, 255);
		p.lighting_rgb = `${p.lighting_r}, ${p.lighting_g}, ${p.lighting_b}`;
		// brightness 0-100
		let br = Number(p.lighting_brightness);
		if (!Number.isFinite(br)) {
			br = targets.brightness;
			repaired = true;
		}
		p.lighting_brightness = clamp(br, 0, 100);
		// HSB from RGB
		const hsv = rgbToHsv(p.lighting_r, p.lighting_g, p.lighting_b);
		p.lighting_hue = Math.round((hsv.h / 360) * 65535);
		p.lighting_saturation = Math.round(hsv.s * 254);
		p.lighting_brightness_254 = Math.round(clamp(p.lighting_brightness, 0, 100) * 2.54);
	} else {
		// temp mode
		let k = Number(p.lighting_kelvin ?? p.lighting_color_temp);
		if (!Number.isFinite(k)) {
			k = targets.kelvin;
			repaired = true;
		}
		p.lighting_kelvin = clamp(k, 2200, 6500);
		let br = Number(p.lighting_brightness);
		if (!Number.isFinite(br)) {
			br = targets.brightness;
			repaired = true;
		}
		p.lighting_brightness = clamp(br, 0, 100);
		// Provide RGB strictly from emotion/complement rule
		p.lighting_r = clamp(emotionRgb.r, 0, 255);
		p.lighting_g = clamp(emotionRgb.g, 0, 255);
		p.lighting_b = clamp(emotionRgb.b, 0, 255);
		p.lighting_rgb = `${p.lighting_r}, ${p.lighting_g}, ${p.lighting_b}`;
		// HSB for white temp: no color (sat 0), hue 0
		p.lighting_hue = 0;
		p.lighting_saturation = 0;
		p.lighting_brightness_254 = Math.round(clamp(p.lighting_brightness, 0, 100) * 2.54);
	}

	return { payload: p, repaired };
}

function shouldFetchSeoulWeather(text) {
	const lower = String(text).toLowerCase();
	const hasSeoul = lower.includes('seoul') || /서울/.test(text);
	if (!hasSeoul) return false;
	const wantsWeather =
		lower.includes('weather') ||
		lower.includes('temperature') ||
		/기온|온도|날씨/.test(text);
	return wantsWeather;
}

async function getSeoulWeather() {
	const latitude = 37.5665;
	const longitude = 126.978;
	const url = new URL('https://api.open-meteo.com/v1/forecast');
	url.searchParams.set('latitude', String(latitude));
	url.searchParams.set('longitude', String(longitude));
	url.searchParams.set('current_weather', 'true');
	url.searchParams.set('timezone', 'Asia/Seoul');
	const response = await fetch(url.toString());
	if (!response.ok) {
		throw new Error(`Weather upstream error (${response.status})`);
	}
	const data = await response.json();
	return {
		temperature: data?.current_weather?.temperature,
		time: data?.current_weather?.time
	};
}


