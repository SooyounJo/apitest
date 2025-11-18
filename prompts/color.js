// Shared color utilities for client and server

export function hexToRgb(hex) {
	let s = String(hex || '').trim().replace('#', '');
	if (s.length === 3) s = s.split('').map((c) => c + c).join('');
	if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
	const num = parseInt(s, 16);
	return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex(r, g, b) {
	const to = (v) => Math.max(0, Math.min(255, Math.round(v)));
	return '#' + [to(r), to(g), to(b)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function rgbToHsl(r, g, b) {
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

export function hslToRgb(h, s, l) {
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

export function rgbToHsv(r, g, b) {
	r /= 255; g /= 255; b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	const d = max - min;
	let h = 0;
	if (d !== 0) {
		switch (max) {
			case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h *= 60;
	}
	const s = max === 0 ? 0 : d / max;
	const v = max;
	return { h, s, v };
}

export function adjustLightingHex(baseHex, opts = {}) {
	try {
		const rgb = hexToRgb(baseHex);
		if (!rgb) return baseHex;
		let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
		if (opts.warm) h = (h + 18 * opts.warm) % 360;
		if (opts.cool) h = (h - 18 * opts.cool + 360) % 360;
		if (opts.saturate) s = Math.max(0, Math.min(1, s + opts.saturate));
		if (opts.brighten) l = Math.max(0, Math.min(1, l + opts.brighten));
		const out = hslToRgb(h, s, l);
		return rgbToHex(out.r, out.g, out.b);
	} catch {
		return baseHex;
	}
}

// Simple quadrant sign inference for HSL complement rule
function isNegativeEmotion(emotion) {
	const e = String(emotion || '').trim();
	if (!e) return false;
	const negActive = ['충격', '당혹', '분노', '짜증', '경계', '긴장', '갈증'];
	const negPassive = ['번아웃', '피로', '실망', '후회', '무력', '공허', '심심함', '수줍음', '체념', '서늘함', '흐릿함', '음울', '회피', '무기력', '흐트러짐', '무심함 ', '희미함', '가라앉음', '소진', '억눌림', '허무', '회한', '두려움', '고독', '향수'];
	return negActive.includes(e) || negPassive.includes(e);
}

// Frontend display: compute emotion-based HSL text/css
export function computeEmotionHsl(hex, emotion) {
	try {
		const rgb = hexToRgb(hex);
		if (!rgb) return { text: '', css: '' };
		let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
		if (isNegativeEmotion(emotion)) {
			h = (h + 180) % 360;
		}
		const sPct = Math.round(s * 100);
		const lPct = Math.round(l * 100);
		const css = `hsl(${Math.round(h)}, ${sPct}%, ${lPct}%)`;
		return { text: `H ${Math.round(h)}, S ${sPct}%, L ${lPct}%`, css };
	} catch {
		return { text: '', css: '' };
	}
}

// Frontend display: derive HSB from lighting config or fallback HEX
export function deriveHSBFromLighting(lighting, lightingColorHex) {
	try {
		if (lighting && lighting.mode === 'rgb') {
			const { r, g, b, brightness } = lighting;
			if ([r, g, b].every((v) => typeof v === 'number')) {
				const hsv = rgbToHsv(r, g, b);
				return {
					hue: Math.round((hsv.h / 360) * 65535),
					saturation: Math.round(hsv.s * 254),
					brightness254: typeof brightness === 'number'
						? Math.round(Math.max(0, Math.min(100, brightness)) * 2.54)
						: Math.round(hsv.v * 254)
				};
			}
		}
		if (lightingColorHex) {
			const rgb = hexToRgb(lightingColorHex);
			if (rgb) {
				const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
				return {
					hue: Math.round((hsv.h / 360) * 65535),
					saturation: Math.round(hsv.s * 254),
					brightness254: Math.round(hsv.v * 254)
				};
			}
		}
		if (lighting && lighting.mode === 'temp') {
			const briPct = typeof lighting.brightness === 'number' ? lighting.brightness : 50;
			return {
				hue: 0,
				saturation: 0,
				brightness254: Math.round(Math.max(0, Math.min(100, briPct)) * 2.54)
			};
		}
		return null;
	} catch {
		return null;
	}
}


