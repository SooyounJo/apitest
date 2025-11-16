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
		if (shouldFetchSeoulWeather(String(prompt))) {
			try {
				const weather = await getSeoulWeather();
				if (typeof weather?.temperature === 'number') {
					extraContext = `Context: As of ${weather.time ?? 'now'} (Asia/Seoul), current temperature in Seoul is ${weather.temperature}°C.`;
				}
			} catch {}
		}

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

		// Enforce presence of environment fields; repair if missing
		try {
			const parsed = JSON.parse(output);
			const ensured = ensureEnvironmentFields(parsed, prompt);
			if (ensured.repaired) {
				output = JSON.stringify(ensured.payload, null, 2);
			}
		} catch {
			// Not JSON — attempt a quick repair round-trip
			const repairMessages = [
				{
					role: 'system',
					content:
						'You repair assistant outputs into strict JSON with keys: emotion, hex, similarity_reason, temperature_c, humidity_pct, brightness_level, music. Use only allowed values. No extra fields or narration.'
				},
				{
					role: 'user',
					content: JSON.stringify({
						current_output: output,
						allowed: {
							temperature_c: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
							humidity_pct: [30, 35, 40, 45, 50, 55, 60, 65, 70],
							brightness_level: [1, 2, 3, 4, 5],
							music: MUSIC_LIST
						}
					})
				}
			];
			try {
				const repairResp = await fetch(`${baseUrl}/chat/completions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${apiKey}`
					},
					body: JSON.stringify({
						model,
						messages: repairMessages,
						response_format: { type: 'json_object' }
					})
				});
				if (repairResp.ok) {
					const rd = await repairResp.json();
					const repairedText =
						rd?.choices?.[0]?.message?.content ?? rd?.choices?.[0]?.text ?? '';
					const ensured = ensureEnvironmentFields(JSON.parse(repairedText), prompt);
					output = JSON.stringify(ensured.payload, null, 2);
				}
			} catch {}
		}

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

// ---------- Color utilities for lighting tone adjustment ----------
function hexToRgb(hex) {
	let s = String(hex || '').trim().replace('#', '');
	if (s.length === 3) s = s.split('').map((c) => c + c).join('');
	const num = parseInt(s, 16);
	return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex(r, g, b) {
	const to = (v) => Math.max(0, Math.min(255, Math.round(v)));
	return '#' + [to(r), to(g), to(b)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function rgbToHsl(r, g, b) {
	r /= 255; g /= 255; b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	let h, s, l = (max + min) / 2;
	if (max === min) {
		h = s = 0;
	} else {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h *= 60;
	}
	return { h, s, l };
}
function hslToRgb(h, s, l) {
	const C = (1 - Math.abs(2 * l - 1)) * s;
	const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - C / 2;
	let rp = 0, gp = 0, bp = 0;
	if (0 <= h && h < 60) { rp = C; gp = X; bp = 0; }
	else if (60 <= h && h < 120) { rp = X; gp = C; bp = 0; }
	else if (120 <= h && h < 180) { rp = 0; gp = C; bp = X; }
	else if (180 <= h && h < 240) { rp = 0; gp = X; bp = C; }
	else if (240 <= h && h < 300) { rp = X; gp = 0; bp = C; }
	else { rp = C; gp = 0; bp = X; }
	return { r: (rp + m) * 255, g: (gp + m) * 255, b: (bp + m) * 255 };
}
function adjustLightingHex(baseHex, opts = {}) {
	try {
		const { r, g, b } = hexToRgb(baseHex);
		let { h, s, l } = rgbToHsl(r, g, b);
		// warm/cool shift
		if (opts.warm) h = (h + 18 * opts.warm) % 360;
		if (opts.cool) h = (h - 18 * opts.cool + 360) % 360;
		// saturation
		if (opts.saturate) s = Math.max(0, Math.min(1, s + opts.saturate));
		// brighten (positive) / dim (negative)
		if (opts.brighten) l = Math.max(0, Math.min(1, l + opts.brighten));
		const rgb = hslToRgb(h, s, l);
		return rgbToHex(rgb.r, rgb.g, rgb.b);
	} catch {
		return baseHex;
	}
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


