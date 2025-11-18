import { useCallback, useMemo, useState } from 'react';
import prompt1 from '../prompts/1';
import prompt2 from '../prompts/2';
import brain from '../prompts/brain';
import { computeEmotionHsl } from '../prompts/color';

const DEFAULT_MODELS = [
	{ id: 'gpt-4o', label: 'gpt-4o (smarter)' },
	{ id: 'gpt-4o-mini', label: 'gpt-4o-mini (faster/cheaper)' },
	{ id: 'gpt-4.1', label: 'gpt-4.1' },
	{ id: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
	{ id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' }
];

const FIXED_PRESETS = [prompt1, prompt2];

export default function ModelTester() {
	const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0].id);
	const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
	const [systemPrompt, setSystemPrompt] = useState(`${brain}\n\n${FIXED_PRESETS[0]}`);
	const [userPrompt, setUserPrompt] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [outputText, setOutputText] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [tokenUsage, setTokenUsage] = useState(null);
	const [copyMessage, setCopyMessage] = useState('');
	const [statusMessage, setStatusMessage] = useState('');
	const [isPresetExpanded, setIsPresetExpanded] = useState(false);

	const [colorHex, setColorHex] = useState('');
	const [environment, setEnvironment] = useState(null);
	const [emotionName, setEmotionName] = useState('');
	const [reasonText, setReasonText] = useState('');
	const [emotionHsl, setEmotionHsl] = useState('');
	const [emotionHslCss, setEmotionHslCss] = useState('');

	const isSubmitDisabled = useMemo(() => {
		return isLoading || userPrompt.trim().length === 0;
	}, [isLoading, userPrompt]);

	const handleGenerate = useCallback(async () => {
		if (isSubmitDisabled) return;
		setErrorMessage('');
		setIsLoading(true);
		setOutputText('');
		setColorHex('');
		setEnvironment(null);
		setEmotionName('');
		setReasonText('');
		try {
			const response = await fetch('/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: selectedModel,
					system: systemPrompt,
					prompt: userPrompt
				})
			});
			if (!response.ok) {
				const errorPayload = await safeJson(response);
				throw new Error(
					errorPayload?.error?.message ||
						errorPayload?.message ||
						`Request failed (${response.status})`
				);
			}
			const result = await response.json();
			setOutputText(result.output || '');
			setTokenUsage(result.usage || null);
			const rawText = result.output || '';

			const hx = extractHexFromText(rawText);
			if (hx) setColorHex(hx);
			const emo = extractEmotionFromText(rawText);
			if (emo) setEmotionName(emo);
			const reason = extractReasonFromText(rawText);
			if (reason) setReasonText(reason);

			let envObj = extractEnvFromText(rawText);
			if (!envObj && emo) {
				envObj = getEnvironmentForEmotion(emo);
			}
			if (!envObj) {
					envObj = {
					tempC: 24,
					humidityPct: 50,
					lighting: { mode: 'temp', kelvin: 3500, brightness: 50 },
					lightingSummary: 'TEMP 3500K; brightness 50%',
					music: 'life is - Scott Buckley'
				};
			} else {
				if (!envObj.lighting) {
					envObj.lighting = coerceLightingFromEnv(envObj);
				}
				if (!envObj.lightingSummary) {
					envObj.lightingSummary = summarizeLighting(envObj.lighting, envObj.lightingColorHex);
				}
				
			}
			setEnvironment(envObj);

			const hslComputed = computeEmotionHsl(hx || '', emo);
			setEmotionHsl(hslComputed.text);
			setEmotionHslCss(hslComputed.css);
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : 'Unexpected error occurred'
			);
		} finally {
			setIsLoading(false);
		}
	}, [isSubmitDisabled, selectedModel, systemPrompt, userPrompt]);

	const handleSubmit = useCallback(
		async (event) => {
			event.preventDefault();
			if (isSubmitDisabled) return;
			await handleGenerate();
		},
		[handleGenerate, isSubmitDisabled]
	);

	const handlePromptKeyDown = useCallback(
		(e) => {
			// Enter to generate, Shift+Enter for newline, ignore while composing (IME)
			if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
				e.preventDefault();
				if (!isSubmitDisabled) {
					handleGenerate();
				}
			}
		},
		[handleGenerate, isSubmitDisabled]
	);

	const handleSelectSlot = useCallback(
		(index) => {
			const text = FIXED_PRESETS[index] || '';
			setSystemPrompt(`${brain}\n\n${text}`);
			setSelectedPresetIndex(index);
			setCopyMessage('');
			setStatusMessage(`슬롯 ${index + 1} 불러옴`);
		},
		[]
	);

	// Removed: explicit "프롬프트+결과 copy" button handler

	const handleCopyValue = useCallback(async (value) => {
		try {
			await copyToClipboard(String(value ?? ''));
			setCopyMessage('Copied');
			setTimeout(() => setCopyMessage(''), 1200);
		} catch {
			setCopyMessage('Copy failed');
		}
	}, []);

	const handleResetAll = useCallback(() => {
		setUserPrompt('');
		setOutputText('');
		setErrorMessage('');
		setTokenUsage(null);
		setCopyMessage('');
		setColorHex('');
		setEnvironment(null);
	}, []);

	return (
		<div className="container">
			<header className="header">
				<div className="title">함께해요 해피 에이피아이</div>
				<div className="badge">Next.js · React · Pages Router · JS</div>
			</header>

			<form className="grid" onSubmit={handleSubmit}>
				<section className="panel section">
					<div className="sectionTitle">Settings</div>

					<label style={{ display: 'block', marginBottom: 12 }}>
						<div className="sectionTitle">Model</div>
						<select
							className="select"
							value={selectedModel}
							onChange={(e) => setSelectedModel(e.target.value)}
						>
							{DEFAULT_MODELS.map((m) => (
								<option key={m.id} value={m.id}>
									{m.label}
								</option>
							))}
						</select>
					</label>

					<label>
						<div className="sectionTitle">System Prompt</div>
						<div className="presetRow" style={{ marginBottom: 8 }}>
							{FIXED_PRESETS.map((_, i) => (
								<button
									key={`slot-${i + 1}`}
									type="button"
									className={`presetBtn presetBtnNumber ${selectedPresetIndex === i ? 'presetBtnActive' : ''}`}
									onClick={() => handleSelectSlot(i)}
									title={`${i + 1}: ${preview(FIXED_PRESETS[i])}`}
									aria-pressed={selectedPresetIndex === i}
								>
									{i + 1}
								</button>
							))}
						</div>

						<div className="selectedBox" title={`${selectedPresetIndex + 1}: ${previewLong(FIXED_PRESETS[selectedPresetIndex])}`}>
							<div className="selectedBoxTitle">Selected preset ({selectedPresetIndex + 1})</div>
							<div className={`selectedBoxText ${isPresetExpanded ? 'selectedBoxExpanded' : 'selectedBoxClamp'}`}>
								{isPresetExpanded
									? FIXED_PRESETS[selectedPresetIndex]
									: previewLong(FIXED_PRESETS[selectedPresetIndex])}
							</div>
							<div style={{ marginTop: 6 }}>
								<button
									type="button"
									className="button buttonSecondary"
									onClick={() => setIsPresetExpanded((v) => !v)}
									title={isPresetExpanded ? '접기' : '더보기'}
								>
									{isPresetExpanded ? '접기' : '더보기'}
								</button>
							</div>
						</div>

						<div className="sectionTitle" style={{ marginTop: 12 }}>Prompt</div>
						<textarea
							className="textarea textareaPrompt"
							placeholder="Ask something..."
							value={userPrompt}
							onChange={(e) => setUserPrompt(e.target.value)}
							onKeyDown={handlePromptKeyDown}
						/>
						<div className="buttonRow" style={{ marginTop: 12 }}>
							<button className="button" type="submit" disabled={isSubmitDisabled}>
								{isLoading ? 'Generating…' : 'Generate'}
							</button>
							{/* Copy prompt+result button removed per request */}
							<button
								type="button"
								className="button buttonDanger"
								onClick={handleResetAll}
								title="모든 입력을 초기화"
							>
								다시 시작
							</button>
						</div>
						{statusMessage ? <div className="footerNote" style={{ marginTop: 8 }}>{statusMessage}</div> : null}
						{copyMessage ? <div className="footerNote" style={{ marginTop: 4 }}>{copyMessage}</div> : null}
					</label>
				</section>

				<section className="panel section resultModal">
					<div className="sectionTitle">Result</div>
					{errorMessage ? <div style={{ color: 'var(--danger)' }}>{errorMessage}</div> : null}
					{colorHex && (
						<div
							className="colorRow clickable"
							title="Copy hex"
							onClick={() => handleCopyValue(colorHex)}
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleCopyValue(colorHex);
                                }
							}}
						>
							<span className="colorDot" style={{ backgroundColor: colorHex }} />
							<span className="footerNote">Hex: {colorHex}</span>
						</div>
					)}
					{emotionName && (
						<div
							className="card clickable"
							style={{ marginTop: 8 }}
							title="Copy emotion"
							onClick={() => handleCopyValue(emotionName)}
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleCopyValue(emotionName);
								}
							}}
						>
							<div className="cardTitle">1) 도출된 감정</div>
							<div className="emotionRow">
								{colorHex ? <span className="chipDot" style={{ backgroundColor: colorHex }} /> : null}
								<span>{emotionName}</span>
							</div>
						</div>
					)}
					{reasonText && (
						<div className="card" style={{ marginTop: 8 }}>
							<div className="cardTitle">유사 이유</div>
							<div className="cardBody">{shortReason(reasonText)}</div>
						</div>
					)}
					{environment && (
						<>
							<div className="miniGrid">
								<div
									className="miniCard clickable"
									title="Copy temperature"
									onClick={() => handleCopyValue(`${environment.tempC}°C`)}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyValue(`${environment.tempC}°C`); } }}
								>
									<div className="miniTitle">온도</div>
									<div className="miniValue">{environment.tempC}°C</div>
								</div>
								<div
									className="miniCard clickable"
									title="Copy humidity"
									onClick={() => handleCopyValue(`${environment.humidityPct}%`)}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyValue(`${environment.humidityPct}%`); } }}
								>
									<div className="miniTitle">습도</div>
									<div className="miniValue">{environment.humidityPct}%</div>
								</div>
								<div
									className="miniCard clickable"
									title="Copy lighting"
									onClick={() => handleCopyValue(environment.lightingSummary || '')}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyValue(environment.lightingSummary || ''); } }}
								>
									<div className="miniTitle">조명</div>
									<div className="miniValue">{environment.lightingSummary || '-'}</div>
								</div>
								
								<div
									className="miniCard clickable"
									title="Copy music"
									onClick={() => handleCopyValue(environment.music)}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyValue(environment.music); } }}
								>
									<div className="miniTitle">음악</div>
									<div className="miniValue">{environment.music}</div>
								</div>
							</div>

							{emotionHsl && (
								<div className="card clickable" style={{ marginTop: 8 }} onClick={() => handleCopyValue(emotionHsl)}>
									<div className="cardTitle">조명 HSL (감정 보정)</div>
									<div className="cardBody" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
										<span className="chipDot" style={{ background: emotionHslCss }} />
										<span className="footerNote">{emotionHsl}</span>
									</div>
								</div>
							)}
						</>
					)}

					{tokenUsage && (
						<div className="miniGrid" style={{ marginTop: 8 }}>
							<div
								className="miniCard clickable"
								title="Copy input tokens"
								onClick={() => handleCopyValue(String(tokenUsage.prompt_tokens ?? 0))}
								role="button"
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleCopyValue(String(tokenUsage.prompt_tokens ?? 0));
									}
								}}
							>
								<div className="miniTitle">입력 토큰</div>
								<div className="miniValue">{tokenUsage.prompt_tokens ?? 0}</div>
							</div>
							<div
								className="miniCard clickable"
								title="Copy output tokens"
								onClick={() => handleCopyValue(String(tokenUsage.completion_tokens ?? 0))}
								role="button"
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleCopyValue(String(tokenUsage.completion_tokens ?? 0));
									}
								}}
							>
								<div className="miniTitle">출력 토큰</div>
								<div className="miniValue">{tokenUsage.completion_tokens ?? 0}</div>
							</div>
							<div
								className="miniCard clickable"
								title="Copy total tokens"
								onClick={() => handleCopyValue(String(tokenUsage.total_tokens ?? ((tokenUsage.prompt_tokens ?? 0) + (tokenUsage.completion_tokens ?? 0))))}
								role="button"
								tabIndex={0}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleCopyValue(String(tokenUsage.total_tokens ?? ((tokenUsage.prompt_tokens ?? 0) + (tokenUsage.completion_tokens ?? 0))));
									}
								}}
							>
								<div className="miniTitle">총합 토큰</div>
								<div className="miniValue">
									{tokenUsage.total_tokens ?? ((tokenUsage.prompt_tokens ?? 0) + (tokenUsage.completion_tokens ?? 0))}
								</div>
							</div>
						</div>
					)}

					<div className="card" style={{ marginTop: 8 }}>
						<div className="cardTitle">Raw JSON</div>
						<pre className="codeBlock">{outputText}</pre>
					</div>
				</section>
			</form>
		</div>
	);
}

async function safeJson(response) {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

async function copyToClipboard(text) {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	const el = document.createElement('textarea');
	el.value = text;
	document.body.appendChild(el);
	el.select();
	document.execCommand('copy');
	document.body.removeChild(el);
}

function preview(text) {
	const t = String(text || '').trim();
	if (!t) return '';
	const first = t.split(/\r?\n/)[0];
	return first.length > 40 ? first.slice(0, 37) + '…' : first;
}

function previewLong(text) {
	const t = String(text || '').replace(/\s+/g, ' ').trim();
	if (!t) return '';
	return t.length > 160 ? t.slice(0, 157) + '…' : t;
}

function shortReason(text) {
	const t = String(text || '').trim();
	if (!t) return '';
	return t.length > 180 ? t.slice(0, 177) + '…' : t;
}

function summarizeLighting(lighting, lightingColorHex) {
	try {
		if (lighting && typeof lighting === 'object') {
			const mode = String(lighting.mode || '').toLowerCase();
			if (mode === 'rgb') {
				const r = lighting.r ?? null;
				const g = lighting.g ?? null;
				const b = lighting.b ?? null;
				const br = typeof lighting.brightness === 'number' ? lighting.brightness : null;
				const rgbPart =
					[r, g, b].every((v) => typeof v === 'number')
						? `RGB ${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`
						: 'RGB';
				return br !== null ? `${rgbPart}; brightness ${Math.round(br)}%` : rgbPart;
			}
			if (mode === 'temp') {
				const k = lighting.kelvin ?? null;
				const br = typeof lighting.brightness === 'number' ? lighting.brightness : null;
				const kPart = typeof k === 'number' ? `TEMP ${Math.round(k)}K` : 'TEMP';
				const main = br !== null ? `${kPart}; brightness ${Math.round(br)}%` : kPart;
				if ([lighting.r, lighting.g, lighting.b].every((v) => typeof v === 'number')) {
					return `${main} | RGB ${Math.round(lighting.r)}, ${Math.round(lighting.g)}, ${Math.round(lighting.b)}`;
				}
				return main;
			}
		}
		if (lightingColorHex) return `HEX ${lightingColorHex}`;
		return '';
	} catch {
		return '';
	}
}



function coerceLightingFromEnv(env) {
	if (!env || typeof env !== 'object') return null;
	const mode = typeof env.lightingMode === 'string' ? env.lightingMode.toLowerCase() : '';
	if (mode === 'rgb') {
		return {
			mode: 'rgb',
			r: typeof env.lightingR === 'number' ? env.lightingR : null,
			g: typeof env.lightingG === 'number' ? env.lightingG : null,
			b: typeof env.lightingB === 'number' ? env.lightingB : null,
			brightness: typeof env.brightnessLevel === 'number' ? env.brightnessLevel : null
		};
	}
	if (mode === 'temp') {
		return {
			mode: 'temp',
			kelvin: typeof env.lightingColorTemp === 'number' ? env.lightingColorTemp : null,
			brightness: typeof env.brightnessLevel === 'number' ? env.brightnessLevel : null,
			r: typeof env.lightingR === 'number' ? env.lightingR : null,
			g: typeof env.lightingG === 'number' ? env.lightingG : null,
			b: typeof env.lightingB === 'number' ? env.lightingB : null
		};
	}
	return null;
}

function extractHexFromText(text) {
	const normalize = (h) => {
		if (!h) return '';
		let s = String(h).trim();
		if (s.startsWith('#')) s = s.slice(1);
		s = s.toUpperCase();
		if (/^[0-9A-F]{6}$/.test(s)) return `#${s}`;
		if (/^[0-9A-F]{3}$/.test(s)) return `#${s}`;
		return '';
	};
	try {
		const obj = JSON.parse(String(text));
		const hx = normalize(obj?.hex);
		if (hx) return hx;
	} catch {}
	const m = String(text).match(/"hex"\s*:\s*"(#?[0-9A-Fa-f]{3,6})"/);
	if (m) return normalize(m[1]);
	return '';
}

function extractEmotionFromText(text) {
	try {
		const obj = JSON.parse(String(text));
		if (obj && typeof obj.emotion === 'string') return obj.emotion;
	} catch {}
	const m = String(text).match(/"emotion"\s*:\s*"(.*?)"/);
	return m ? m[1] : '';
}

function extractReasonFromText(text) {
	try {
		const obj = JSON.parse(String(text));
		if (obj && typeof obj.similarity_reason === 'string') return obj.similarity_reason;
	} catch {}
	const m = String(text).match(/"similarity_reason"\s*:\s*"(.*?)"/s);
	return m ? m[1] : '';
}

function extractEnvFromText(text) {
	try {
		const obj = JSON.parse(String(text));
		if (!obj || typeof obj !== 'object') return null;
		const toNumber = (v) => {
			if (v === undefined || v === null) return null;
			if (typeof v === 'number') return Number.isFinite(v) ? v : null;
			const s = String(v).trim();
			const m = s.match(/-?\d+(\.\d+)?/);
			if (!m) return null;
			const n = Number(m[0]);
			return Number.isFinite(n) ? n : null;
		};
		const toInt = (v) => {
			const n = toNumber(v);
			return n === null ? null : Math.round(n);
		};
		const normalizeHex = (h) => {
			if (!h) return '';
			let s = String(h).trim();
			if (s.startsWith('#')) s = s.slice(1);
			s = s.toUpperCase();
			if (/^[0-9A-F]{6}$/.test(s) || /^[0-9A-F]{3}$/.test(s)) return `#${s}`;
			return '';
		};
		const tempC =
			toNumber(obj.temperature_celsius) ??
			toNumber(obj.temp_c) ??
			toNumber(obj.tempC) ??
			null;
		const humidityPct =
			toNumber(obj.humidity_percent) ??
			toNumber(obj.humidity) ??
			toNumber(obj.humidityPct) ??
			null;
		const brightnessLevel =
			toInt(obj.lighting_brightness) ??
			toInt(obj.brightness) ??
			null;
		const illuminanceLux =
			toNumber(obj.illuminance_lux) ??
			null;
		const lightingColorHex =
			normalizeHex(obj.lighting_color_hex) ||
			normalizeHex(obj.lightingHex) ||
			normalizeHex(obj.lighting_color) ||
			'';
		const music =
			typeof obj.music_title === 'string'
				? `${obj.music_title} - ${obj.music_artist || ''}`
				: typeof obj.music_recommendation === 'string'
				? obj.music_recommendation
				: '';
		const lightingMode =
			typeof obj.lighting_mode === 'string'
				? obj.lighting_mode.toLowerCase()
				: null;
		let lightingR = toInt(obj.lighting_r);
		let lightingG = toInt(obj.lighting_g);
		let lightingB = toInt(obj.lighting_b);
		let lightingColorTemp =
			toNumber(obj.lighting_color_temp) ??
			toNumber(obj.lighting_kelvin) ??
			null;
		const lightingHue = toInt(obj.lighting_hue);
		const lightingSaturation254 = toInt(obj.lighting_saturation);
		const lightingBrightness254 = toInt(obj.lighting_brightness_254);
		if (lightingR === null || lightingG === null || lightingB === null) {
			if (typeof obj.lighting_rgb === 'string') {
				const parts = obj.lighting_rgb.split(',').map((x) => toInt(x));
				if (parts.length >= 3) {
					if (lightingR === null) lightingR = parts[0];
					if (lightingG === null) lightingG = parts[1];
					if (lightingB === null) lightingB = parts[2];
				}
			}
		}

		if (tempC !== null || humidityPct !== null || brightnessLevel !== null || illuminanceLux !== null || lightingColorHex || music || lightingMode || lightingR !== null || lightingG !== null || lightingB !== null || lightingColorTemp !== null || lightingHue !== null || lightingSaturation254 !== null || lightingBrightness254 !== null) {
			return {
				tempC: tempC ?? 21,
				humidityPct: humidityPct ?? 50,
				brightnessLevel: brightnessLevel ?? 3,
				illuminanceLux: illuminanceLux ?? null,
				lightingColorHex: lightingColorHex || '',
				music: music || 'ambient',
				lightingMode: lightingMode || null,
				lightingR: lightingR ?? null,
				lightingG: lightingG ?? null,
				lightingB: lightingB ?? null,
				lightingColorTemp: lightingColorTemp ?? null,
				lightingHSB: {
					hue: lightingHue ?? null,
					saturation: lightingSaturation254 ?? null,
					brightness254: lightingBrightness254 ?? null
				}
			};
		}
		return null;
	} catch {
		return null;
	}
}

function getEnvironmentForEmotion(emotion) {
	const e = String(emotion || '').trim();
	const presets = [
		{
			match: ['기쁨', '설렘', '경쾌', '감격', '흥미', '기대', '활력', '상쾌함', '청량'],
			value: { tempC: 21.5, humidityPct: 43, brightnessLevel: 4, lightingColorHex: '', music: '331Music - Happy Stroll' }
		},
		{
			match: ['평온', '편안', '안정감', '담담', '잔잔함', '고요함', '조용함', '완화'],
			value: { tempC: 21.0, humidityPct: 48, brightnessLevel: 2, lightingColorHex: '', music: 'Life is - Scott Burkely' }
		},
		{
			match: ['분노', '짜증', '경계', '긴장'],
			value: { tempC: 20.5, humidityPct: 44, brightnessLevel: 3, lightingColorHex: '', music: 'The Travelling Symphony - Savfk' }
		},
		{
			match: ['피로', '무기력', '번아웃', '소진'],
			value: { tempC: 23.0, humidityPct: 52, brightnessLevel: 2, lightingColorHex: '', music: 'New Beginnings - Tokyo Music Walker' }
		},
		{
			match: ['공허', '허무', '가라앉음', '음울', '체념'],
			value: { tempC: 21.5, humidityPct: 52, brightnessLevel: 2, lightingColorHex: '', music: 'Solace - Scott Burkely' }
		},
		{
			match: ['갈증'],
			value: { tempC: 21.0, humidityPct: 48, brightnessLevel: 3, lightingColorHex: '', music: 'Shoulders Of Giants - Scott Burkely' }
		},
		{
			match: ['두려움', '고독'],
			value: { tempC: 21.0, humidityPct: 50, brightnessLevel: 2, lightingColorHex: '', music: 'Solstice - Scott Burkely' }
		},
		{
			match: ['흥분'],
			value: { tempC: 21.5, humidityPct: 45, brightnessLevel: 4, lightingColorHex: '', music: 'Sunny Side Up - Victor Lundberg' }
		}
	];
	for (const p of presets) {
		if (p.match.includes(e)) return p.value;
	}
	return { tempC: 21, humidityPct: 50, brightnessLevel: 3, lightingColorHex: '', music: 'Life is - Scott Burkely' };
}

function formatTokenUsage(usage) {
	try {
		const p = Number(usage?.prompt_tokens) || 0;
		const c = Number(usage?.completion_tokens) || 0;
		const t = Number(usage?.total_tokens) || p + c;
		return `Tokens: ${t} (입력 ${p} / 출력 ${c})`;
	} catch {
		return '';
	}
}


