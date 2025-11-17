import { useCallback, useMemo, useState } from 'react';

const DEFAULT_MODELS = [
	{ id: 'gpt-4o', label: 'gpt-4o (smarter)' },
	{ id: 'gpt-4o-mini', label: 'gpt-4o-mini (faster/cheaper)' },
	{ id: 'gpt-4.1', label: 'gpt-4.1' },
	{ id: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
	{ id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' }
];

const FIXED_PRESETS = [
	`You are an Emotion-to-Environment (Color, Music, Lighting) Mapping Model.

Your job is to analyze the user's input and control the entire environment (Screen Color, HVAC, Music, and External Lighting).

──────────────────────────────
A. OUTPUT FORMAT (STRICT JSON)

Output ONLY this JSON object. Do NOT add any explanations or text outside the brackets.

{
  "emotion": "String (One of the 100 items from Section G)",
  "hex": "String (Fixed HEX from Section G)",
  "temperature_celsius": Number or null,
  "humidity_percent": Number or null,
  "music_title": "String or null",
  "music_artist": "String or null",
  "lighting_mode": "String ('RGB' or 'TEMP')",
  "lighting_rgb": "String (e.g., '255, 240, 200' or null if TEMP mode)",
  "lighting_kelvin": Number or null (2200 to 6500, null if RGB mode),
  "lighting_brightness": Number (0 to 100),
  "lighting_hue": Number or null (0 to 65535),
  "lighting_saturation": Number or null (0 to 254),
  "lighting_brightness_254": Number or null (0 to 254),
  "similarity_reason": "String (Explanation including lighting logic)"
}

──────────────────────────────
B. CONTENT FILTER
If input contains explicit sexual/abusive content:
- emotion: "무색"
- hex: "CECED0"
- all environment values (temp, humid, music, lighting): null
- similarity_reason: "Content filtered."

──────────────────────────────
C. EMOTION & ENVIRONMENT MAPPING RULES
Step 1: Detect Emotion & Map to 100-item Database (Section G).
Step 2: Determine Quadrant & Set HVAC (Temp/Humidity).

[Quadrants & HVAC]
1. 긍정-능동 (Pos-Active): 22.5°C / 57.5% (Excited, Happy, Clear)
2. 긍정-수동 (Pos-Passive): 26.0°C / 57.5% (Relaxed, Cozy, Peaceful)
3. 부정-능동 (Neg-Active): 21.0°C / 37.5% (Angry, Tense, Shocked)
4. 부정-수동 (Neg-Passive): 25.5°C / 37.5% (Depressed, Tired, Void)
* Default/Neutral: 24.0°C / 50.0%

Step 3: Select Music based on Quadrant (Section F).

──────────────────────────────
D. LIGHTING LOGIC (Therapeutic & Atmospheric)

You must generate lighting values dynamically based on the "Lighting Strategy" below.
DO NOT simply copy the emotion hex. The lighting must "complement" or "enhance" the user's state.

[Global Constraints]
1. NO Neon/Primary Colors: Avoid pure Red (255,0,0), Green, Blue. Use sophisticated, mixed hues.
2. Visual Comfort: Ensure colors are aesthetically pleasing (Ambient/Pastel/Warm).
3. White Handling: If the calculated color is very close to white, use "lighting_mode": "TEMP" and set "lighting_kelvin".

[Lighting Strategies per Quadrant]
- Negative Active → Cool Down (Teal/Soft Blue/Minted), Brightness 40–60
- Negative Passive → Warm Up (Warm White/Peach), Brightness 70–90
- Positive Active → Energize (Golden/Amber/Soft Pink), Brightness 80–100
- Positive Passive → Deep Rest (Candlelight/Sunset or Soft White), Brightness 30–60
- Neutral/Ambient (담담/균형/무심함/평정심) → Low-sat pastels or TEMP 3500–4000K, Brightness ~50

──────────────────────────────
E. MUSIC LIBRARY (Fixed)
1. 긍정-수동: "life is"(Scott Buckley), "Glow"(Scott Buckley), "Clean Soul - Calming"(Kevin MacLeod), "Solace"(Scott Buckley)
2. 긍정-능동: "happy stroll"(331music), "Ukulele Dance"(Derek Fiechter & Brandon Fiechter), "Happy Alley"(Kevin MacLeod), "sunny side up"(Victor Lundberg)
3. 부정-수동: "solstice"(Scott Buckley), "Amberlight"(Scott Buckley), "Borealis"(Scott Buckley), "A Kind Of Hope"(Scott Buckley)
4. 부정-능동: "New Beginnings"(Tokyo Music Walker), "the travelling symphony"(Savfk), "Echoes"(Scott Buckley), "Shoulders Of Giants"(Scott Buckley)

──────────────────────────────
G. EMOTION–COLOR DATABASE (100 Items - Fixed)
[Use the user's fixed list; each emotion has a fixed HEX]`,
	`You are an Emotion-to-Color-Environment-and-Music-and-Lighting Mapping Model.

Your job:
1. Receive any user input (emotion words, sentences, slang, jokes, memes, physical states, random text, mild profanity, etc.).
2. Detect the underlying emotional tone.
3. Map it to the most similar emotion from the fixed 100-item Emotion–Color Database below.
4. For that chosen emotion, determine its emotional quadrant internally and compute a single target temperature and humidity.
5. Based on that same emotion and quadrant, select ONE suitable music track (title + artist) from the fixed 16-track music library.
6. Based on that same emotion and quadrant, generate ONE ambient lighting setting (RGB or white color temperature).
7. Always output exactly ONE JSON object and nothing else, in the following format:

{
  "emotion": "...",
  "hex": "...",
  "temperature_celsius": ...,
  "humidity_percent": ...,
  "music_title": "...",
  "music_artist": "...",
  "lighting_mode": "...",
  "lighting_r": ...,
  "lighting_g": ...,
  "lighting_b": ...,
  "lighting_color_temp": ...,
  "lighting_hue": ...,
  "lighting_saturation": ...,
  "lighting_brightness_254": ...,
  "similarity_reason": "..."
}

Constraints:
- "emotion" must be one of the 100 fixed labels; "hex" must be the fixed HEX for that label.
- "music_title" and "music_artist" MUST come from the fixed music library.
- "lighting_mode" MUST be either "rgb" or "temp".
  - If "rgb": set "lighting_r/g/b" numbers (0–255) and "lighting_color_temp" = null.
  - If "temp": set "lighting_color_temp" (Kelvin) and r/g/b = null.
- Fallback (“무색”, CECED0) only for explicit sexual/abusive content; then set temp/humid/music/lighting to null.

Quadrant targets:
- 긍정-능동: 22.5°C / 57.5%
- 긍정-수동: 26°C / 57.5%
- 부정-능동: 21°C / 37.5%
- 부정-수동: 25.5°C / 37.5%
- Default: 24°C / 50%`
];

export default function ModelTester() {
	const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0].id);
	const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
	const [systemPrompt, setSystemPrompt] = useState(FIXED_PRESETS[0]);
	const [userPrompt, setUserPrompt] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [outputText, setOutputText] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [tokenUsage, setTokenUsage] = useState(null);
	const [isCopying, setIsCopying] = useState(false);
	const [copyMessage, setCopyMessage] = useState('');
	const [statusMessage, setStatusMessage] = useState('');
	const [isPresetExpanded, setIsPresetExpanded] = useState(false);
	const [colorHex, setColorHex] = useState('');
	const [environment, setEnvironment] = useState(null);
	const [emotionName, setEmotionName] = useState('');
	const [reasonText, setReasonText] = useState('');
	const [emotionHsl, setEmotionHsl] = useState('');
	const [emotionHslCss, setEmotionHslCss] = useState('');

	// No user-edited presets; fixed set only

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
					hsbSummary: formatHSB(deriveHSBFromLighting({ mode: 'temp', brightness: 50 }, '')),
					music: 'life is - Scott Buckley'
				};
			} else {
				// ensure lighting object and summary
				if (!envObj.lighting) {
					envObj.lighting = coerceLightingFromEnv(envObj);
				}
				if (!envObj.lightingSummary) {
					envObj.lightingSummary = summarizeLighting(envObj.lighting, envObj.lightingColorHex);
				}
				// derive or format HSB summary
				if (!envObj.hsbSummary) {
					const hsb =
						(envObj.lightingHSB && (typeof envObj.lightingHSB.hue === 'number' || typeof envObj.lightingHSB.saturation === 'number' || typeof envObj.lightingHSB.brightness254 === 'number'))
							? envObj.lightingHSB
							: deriveHSBFromLighting(envObj.lighting, envObj.lightingColorHex);
					envObj.hsbSummary = formatHSB(hsb);
					if (!envObj.lightingHSB && hsb) envObj.lightingHSB = hsb;
				}
			}
			setEnvironment(envObj);
			// compute emotion HSL (positive -> same, negative -> complementary)
			const baseHex = hx || envObj.lightingColorHex || '';
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

	const handleClear = useCallback(() => {
		setUserPrompt('');
		setOutputText('');
		setErrorMessage('');
		setTokenUsage(null);
		setCopyMessage('');
		setStatusMessage('');
	}, []);

	const handleSelectSlot = useCallback(
		(index) => {
			const text = FIXED_PRESETS[index] || '';
			setSystemPrompt(text);
			setSelectedPresetIndex(index);
			setCopyMessage('');
			setStatusMessage(`슬롯 ${index + 1} 불러옴`);
		},
		[]
	);

	const handleCopyPromptResult = useCallback(async () => {
		setCopyMessage('');
		setIsCopying(true);
		try {
			const content = `Prompt:\n${String(userPrompt || '')}\n\nResult:\n${String(outputText || '')}`;
			await copyToClipboard(content);
			setCopyMessage('Copied prompt and result');
		} catch (err) {
			setCopyMessage('Copy failed');
		} finally {
			setIsCopying(false);
		}
	}, [outputText, userPrompt]);

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
		// Keep current system prompt, preset selection, model, and label as-is.
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
						{/* Compose prompt */}
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
							<button
								type="button"
								className="button buttonSecondary"
								onClick={handleCopyPromptResult}
								disabled={isCopying || (!userPrompt.trim() && !String(outputText || '').trim())}
								title="프롬프트와 결과를 클립보드로 복사"
							>
								{isCopying ? 'Copying…' : '프롬프트+결과 copy'}
							</button>
							<button
								type="button"
								className="button buttonDanger"
								onClick={handleResetAll}
								title="모든 입력을 초기화"
							>
								다시 시작
							</button>
						</div>
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
					{environment && (
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
								title="Copy lighting HSB"
								onClick={() => handleCopyValue(environment.hsbSummary || '')}
								role="button"
								tabIndex={0}
								onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyValue(environment.hsbSummary || ''); } }}
							>
								<div className="miniTitle">조명 HSB</div>
								<div className="miniValue">{environment.hsbSummary || '-'}</div>
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
							<div
								className="miniCard clickable"
								title="Copy emotion HSL"
								onClick={() => handleCopyValue(emotionHsl)}
								role="button"
								tabIndex={0}
								onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyValue(emotionHsl); } }}
							>
								<div className="miniTitle">조명 HSL</div>
								<div className="miniValue" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
									{emotionHslCss ? <span className="chipDot" style={{ backgroundColor: emotionHslCss }} /> : null}
									{emotionHsl || '-'}
								</div>
							</div>
						</div>
					)}
					{reasonText && (
						<div className="card" style={{ marginTop: 8 }}>
							<div className="cardTitle">3) 도출 이유</div>
							<div className="reasonText">{shortReason(reasonText)}</div>
						</div>
					)}
					{tokenUsage && (
						<div className="footerNote" style={{ marginTop: 8 }}>
							Tokens — input: {tokenUsage.prompt_tokens ?? '—'}, output:{' '}
							{tokenUsage.completion_tokens ?? '—'}, total:{' '}
							{tokenUsage.total_tokens ?? '—'}
						</div>
					)}
				</section>
			</form>

			{(copyMessage || statusMessage) && (
				<div
					className="footerNote"
					style={{ marginTop: 12, color: '#22c55e' }}
				>
					{copyMessage || statusMessage}
				</div>
			)}
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

function deriveLabel(text) {
	const t = String(text || '').trim();
	if (!t) return '';
	// take first line or up to 60 chars
	const firstLine = t.split(/\r?\n/)[0];
	return firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine;
}

async function copyToClipboard(text) {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	// Fallback for older browsers
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
				// If server provided RGB alongside TEMP, append it
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

function formatHSB(hsb) {
	try {
		if (!hsb || typeof hsb !== 'object') return '';
		const hasHue = typeof hsb.hue === 'number';
		const hasSat = typeof hsb.saturation === 'number';
		const hasBri = typeof hsb.brightness254 === 'number';
		if (!hasHue && !hasSat && !hasBri) return '';
		const parts = [];
		if (hasHue) parts.push(`Hue ${Math.round(hsb.hue)}`);
		if (hasSat) parts.push(`Sat ${Math.round(hsb.saturation)}`);
		if (hasBri) parts.push(`Bri254 ${Math.round(hsb.brightness254)}`);
		return parts.join(', ');
	} catch {
		return '';
	}
}

function hexToRgbSimple(hex) {
	if (!hex) return null;
	let s = String(hex).trim();
	if (s.startsWith('#')) s = s.slice(1);
	if (s.length === 3) s = s.split('').map((c) => c + c).join('');
	if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
	const num = parseInt(s, 16);
	return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHsvSimple(r, g, b) {
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

function rgbToHslSimple(r, g, b) {
	r /= 255; g /= 255; b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	let h = 0, s = 0;
	const l = (max + min) / 2;
	if (max !== min) {
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

function emotionQuadrant(emotion) {
	const e = String(emotion || '').trim();
	if (!e) return 'neutral';
	const posActive = ['놀라움', '흥분', '설렘', '활력', '흥미', '감격', '기쁨', '기대', '몰입', '집중', '회복', '자각', '도취', '영감', '호기심', '상쾌함', '기대감', '산뜻함', '뿌듯함', '기력회복', '청량', '명료', '맑음', '경쾌', '발돋움', '포커스', '자기확신'];
	if (posActive.includes(e)) return 'positive';
	const posPassive = ['고독', '만족', '느긋', '평온', '편안', '애틋함', '향수', '아득함', '해갈감', '충만함', '위안', '고요함', '침착함', '균형감', '온화함', '차분함', '무심함', '감상', '진정', '여유', '꿈결', '몽환', '미온', '관조', '평정심', '포용', '충족감', '해소', '편유', '조용함', '온기', '담담', '완화', '설원감', '은은함', '잔잔함'];
	if (posPassive.includes(e)) return 'positive';
	const negActive = ['충격', '당혹', '분노', '짜증', '경계', '긴장', '갈증'];
	if (negActive.includes(e)) return 'negative';
	const negPassive = ['번아웃', '피로', '실망', '후회', '무력', '공허', '심심함', '수줍음', '체념', '서늘함', '흐릿함', '음울', '회피', '무기력', '흐트러짐', '무심함 ', '희미함', '가라앉음', '소진', '억눌림', '허무', '회한', '두려움', '고독', '향수'];
	if (negPassive.includes(e)) return 'negative';
	return 'neutral';
}

function computeEmotionHsl(hex, emotion) {
	try {
		const rgb = hexToRgbSimple(hex);
		if (!rgb) return { text: '', css: '' };
		const q = emotionQuadrant(emotion);
		let { h, s, l } = rgbToHslSimple(rgb.r, rgb.g, rgb.b);
		if (q === 'negative') {
			h = (h + 180) % 360; // complementary for negative emotions
		}
		// Keep S/L from the emotion palette as-is (only rotate Hue for negative),
		// so lighting stays in the same tone family as the provided HEX palette.
		const sPct = Math.round(s * 100);
		const lPct = Math.round(l * 100);
		const css = `hsl(${Math.round(h)}, ${sPct}%, ${lPct}%)`;
		return { text: `H ${Math.round(h)}, S ${sPct}%, L ${lPct}%`, css };
	} catch {
		return { text: '', css: '' };
	}
}
function deriveHSBFromLighting(lighting, lightingColorHex) {
	try {
		// Prefer explicit RGB values
		if (lighting && lighting.mode === 'rgb') {
			const { r, g, b, brightness } = lighting;
			if ([r, g, b].every((v) => typeof v === 'number')) {
				const hsv = rgbToHsvSimple(r, g, b);
				return {
					hue: Math.round((hsv.h / 360) * 65535),
					saturation: Math.round(hsv.s * 254),
					brightness254: typeof brightness === 'number'
						? Math.round(Math.max(0, Math.min(100, brightness)) * 2.54)
						: Math.round(hsv.v * 254)
				};
			}
		}
		// Fallback to HEX
		if (lightingColorHex) {
			const rgb = hexToRgbSimple(lightingColorHex);
			if (rgb) {
				const hsv = rgbToHsvSimple(rgb.r, rgb.g, rgb.b);
				return {
					hue: Math.round((hsv.h / 360) * 65535),
					saturation: Math.round(hsv.s * 254),
					brightness254: Math.round(hsv.v * 254)
				};
			}
		}
		// TEMP mode → treat as white: sat 0, hue arbitrary 0
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
			// also carry RGB if available (server now fills it even in TEMP mode)
			r: typeof env.lightingR === 'number' ? env.lightingR : null,
			g: typeof env.lightingG === 'number' ? env.lightingG : null,
			b: typeof env.lightingB === 'number' ? env.lightingB : null
		};
	}
	return null;
}

function normalizeToFive(arr) {
	const base = [
		{ id: 'slot1', text: '' },
		{ id: 'slot2', text: '' },
		{ id: 'slot3', text: '' },
		{ id: 'slot4', text: '' },
		{ id: 'slot5', text: '' }
	];
	for (let i = 0; i < Math.min(arr.length, 5); i++) {
		base[i].text = arr[i]?.text || '';
	}
	if (!base[0].text) base[0].text = 'You are a helpful assistant.';
	return base;
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
		// Parse channel values regardless of mode so we can show RGB alongside TEMP
		let lightingR = toInt(obj.lighting_r);
		let lightingG = toInt(obj.lighting_g);
		let lightingB = toInt(obj.lighting_b);
		let lightingColorTemp =
			toNumber(obj.lighting_color_temp) ??
			toNumber(obj.lighting_kelvin) ??
			null;
		// HSB style fields
		const lightingHue = toInt(obj.lighting_hue);
		const lightingSaturation254 = toInt(obj.lighting_saturation);
		const lightingBrightness254 = toInt(obj.lighting_brightness_254);
		// Parse "lighting_rgb": "r, g, b" if provided and per-channel values are missing
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


