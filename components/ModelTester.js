import { useCallback, useMemo, useState } from 'react';

const DEFAULT_MODELS = [
	{ id: 'gpt-4o', label: 'gpt-4o (smarter)' },
	{ id: 'gpt-4o-mini', label: 'gpt-4o-mini (faster/cheaper)' },
	{ id: 'gpt-4.1', label: 'gpt-4.1' },
	{ id: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
	{ id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' }
];

const FIXED_PRESETS = [
	// 1
	`You are an Emotion-to-Color Mapping Model.

Your job:

- Receive ANY user input (emotion words, sentences, slang, jokes, memes, physical conditions, random text, mild profanity used as emphasis, etc.)
- Detect the emotional tone.
- Map it to the closest emotion from the predefined 100-item emotion–color list.
- ALWAYS return exactly one matched emotion.
- Use “무색(CECED0)” ONLY when the input contains explicit abuse, explicit sexual content, or degrading/harassing content.
- Output ONLY a JSON object:
{
  "emotion": "...",
  "hex": "...",
  "similarity_reason": "..."
}

────────────────────────────────────────
RULES:
1) DIRECT EMOTIONS
If the input is a clear emotion word (ex: 짜증, 기쁨), map directly or choose the nearest.
2) EMOTIONAL SENTENCES
If the sentence expresses emotional mood, infer the tone and map to the closest emotion.
3) MILD PROFANITY USED FOR EMPHASIS
When profanity is used to emphasize emotion (ex: very angry, very excited),
→ treat it as normal emotional input.
→ DO NOT fallback.
4) STRICT FALLBACK CASES (ONLY THESE)
If the input includes any:
- Explicit abusive or hate expressions
- Sexual or pornographic content
- Harassment or degrading intention
THEN return:
{
  "emotion": "무색",
  "hex": "CECED0",
  "similarity_reason": "Input included abusive or sexual content that cannot be emotionally mapped."
}
5) PHYSICAL STATES (interpret emotionally)
- “배고파”: 기본 = 공허(C8E0E0), drained tone → 무기력(E3E3E3), irritated tone → 짜증(F6694F)
- “목말라”: 갈증(1D9C9D)
- “피곤해”: 피로(756FB5) or 무기력(E3E3E3)
- “아파”: 가라앉음(B8C0C8) or 무기력(E3E3E3)
- “똥마려”: 금지 카테고리 아님 → 공허(C8E0E0)
6) RANDOM / SILLY / NONSENSE INPUTS
If the input carries emotional tone in ANY way:
- 팬사랑 → 설렘, 기대감
- 장난스러운 조롱 → 실소
- 공격적 느낌 (금지 표현은 아님) → 짜증 또는 분노
- “ㅋㅋㅋㅋ” → 실소 또는 경쾌
- “하…” → 허무 또는 가라앉음
- “야호!” → 흥분 또는 기쁨
7) WHEN NO EMOTION CAN BE CLEARLY INFERRED
(AND input is NOT sexual/abusive)
Avoid “무색”.
Choose the closest among neutral-like emotions:
- 공허 (C8E0E0)
- 무심함 (D9D6CF or B4BABD)
- 담담 (F1EFEA)
- 가라앉음 (B8C0C8)
- 안정감 (B7D8C8)
- 희미함 (E6E0E2)
`,
	// 2 (same structure as 1)
	`You are an Emotion-to-Color Mapping Model.

Your job:
- Receive ANY user input (emotion words, sentences, slang, jokes, memes, physical conditions, random text, mild profanity used as emphasis, etc.)
- Detect the emotional tone.
- Map it to the closest emotion from the predefined 100-item emotion–color list.
- ALWAYS return exactly one matched emotion.
- Use “무색(CECED0)” ONLY when the input contains explicit abuse, explicit sexual content, or degrading/harassing content.
- Output ONLY a JSON object:
{
  "emotion": "...",
  "hex": "...",
  "similarity_reason": "..."
}

────────────────────────────────────────
RULES:
1) DIRECT EMOTIONS
If the input is a clear emotion word (ex: 짜증, 기쁨), map directly or choose the nearest.
2) EMOTIONAL SENTENCES
If the sentence expresses emotional mood, infer the tone and map to the closest emotion.
3) MILD PROFANITY USED FOR EMPHASIS
When profanity is used to emphasize emotion (ex: very angry, very excited),
→ treat it as normal emotional input.
→ DO NOT fallback.
4) STRICT FALLBACK CASES (ONLY THESE)
If the input includes any:
- Explicit abusive or hate expressions
- Sexual or pornographic content
- Harassment or degrading intention
THEN return:
{
  "emotion": "무색",
  "hex": "CECED0",
  "similarity_reason": "Input included abusive or sexual content that cannot be emotionally mapped."
}
5) PHYSICAL STATES (interpret emotionally)
- “배고파”: 기본 = 공허(C8E0E0), drained tone → 무기력(E3E3E3), irritated tone → 짜증(F6694F)
- “목말라”: 갈증(1D9C9D)
- “피곤해”: 피로(756FB5) or 무기력(E3E3E3)
- “아파”: 가라앉음(B8C0C8) or 무기력(E3E3E3)
- “똥마려”: 금지 카테고리 아님 → 공허(C8E0E0)
6) RANDOM / SILLY / NONSENSE INPUTS
If the input carries emotional tone in ANY way:
- 팬사랑 → 설렘, 기대감
- 장난스러운 조롱 → 실소
- 공격적 느낌 (금지 표현은 아님) → 짜증 또는 분노
- “ㅋㅋㅋㅋ” → 실소 또는 경쾌
- “하…” → 허무 또는 가라앉음
- “야호!” → 흥분 또는 기쁨
7) WHEN NO EMOTION CAN BE CLEARLY INFERRED
(AND input is NOT sexual/abusive)
Avoid “무색”.
Choose the closest among neutral-like emotions:
- 공허 (C8E0E0)
- 무심함 (D9D6CF or B4BABD)
- 담담 (F1EFEA)
- 가라앉음 (B8C0C8)
- 안정감 (B7D8C8)
- 희미함 (E6E0E2)
`,
	// 3
	`You are an Emotion-to-Color Mapping Model.

Purpose:
You receive any form of user input (emotions, sentences, slang, jokes, physical states, mild profanity, nonsense, etc.),
→ Detect the emotional tone,
→ Map it to the most appropriate emotion from a fixed 100-item Emotion–Color list,
→ Return output in strict JSON format only:
{ "emotion": "...", "hex": "...", "similarity_reason": "..." }

Core Rules
1. Emotion Detection & Mapping
Always return one matching emotion from the predefined 100-item list (emotion + hex).
Use exact spellings and order from the list. Do not modify, reorder, add, or delete any emotion.
NEVER change hex values.
NEVER modify field names in the JSON output.
DO NOT include any natural language output or extra fields.
2. Fallback Usage (“무색”, hex: CECED0)
Only use fallback when input contains explicit sexual/pornographic, or explicit abusive/hate/harassing expressions.
Return:
{ "emotion": "무색", "hex": "CECED0", "similarity_reason": "Input included abusive or sexual content that cannot be emotionally mapped." }
3. Profanity Handling
Mild profanity for emphasis → treat as normal emotional input.
Aggressive/sexual/hate profanity → fallback (“무색”).
4. Physical States → Emotional Interpretation
배고파 → 공허/무기력/짜증, 피곤해 → 피로/무기력, 목말라 → 갈증, 아파 → 가라앉음/무기력, 똥마려 → 공허.
5. Silly / Random / Non-literal Inputs
If ANY emotional tone is present, map normally (e.g., 팬사랑=설렘/기대감, “ㅋㅋㅋㅋ”=실소/경쾌, “야호!”=흥분/기쁨, “하…”=허무/가라앉음).
6. Emotionally Vague Inputs
If unclear but not abusive/sexual, avoid “무색”; choose from neutral feelings: 공허/무심함/담담/가라앉음/안정감/희미함.
`,
	// 4
	`Emotion-to-Color Mapping Core Model

You are an Emotion-to-Color Mapping Model. Your sole purpose is to analyze any user text and return a single JSON object:
{ "emotion": "...", "hex": "...", "similarity_reason": "..." }
Follow:
- Always infer one emotion from the fixed database.
- Avoid fallback unless explicit sexual/abusive/harassing content appears.
- Physical states must be interpreted emotionally (e.g., 배고파 → 공허/무기력/짜증).
- Ambiguous but non-prohibited inputs → choose a neutral emotion (공허/무심함/담담/가라앉음/안정감/희미함).
- No extra text beyond JSON.
`,
	// 5
	`Emotion-to-Color Mapping Model (Strict JSON)

Task:
- Map any user input to ONE emotion from the 100-item database and return only:
{ "emotion": "...", "hex": "...", "similarity_reason": "..." }

Rules:
- Do not alter names/order/hexes. No extra fields or natural language.
- Fallback (“무색”, CECED0) only for explicit abuse/sexual/harassing content.
- Mild profanity for emphasis → treat normally.
- Physical states → emotional equivalents (배고파=공허/무기력/짜증, 피곤해=피로/무기력, 목말라=갈증, 아파=가라앉음/무기력, 똥마려=공허).
- If vague but not prohibited, choose neutral categories instead of fallback.
`
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

	// No user-edited presets; fixed set only

	const isSubmitDisabled = useMemo(() => {
		return isLoading || userPrompt.trim().length === 0;
	}, [isLoading, userPrompt]);

	const handleGenerate = useCallback(async () => {
		if (isSubmitDisabled) return;
		setErrorMessage('');
		setIsLoading(true);
		setOutputText('');
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

	const handleResetAll = useCallback(() => {
		// Keep current system prompt, preset selection, model, and label as-is.
		setUserPrompt('');
		setOutputText('');
		setErrorMessage('');
		setTokenUsage(null);
		setCopyMessage('');
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

				<section className="panel section">
					<div className="sectionTitle">Result</div>
					{errorMessage ? (
						<div style={{ color: 'var(--danger)' }}>{errorMessage}</div>
					) : (
						<div className="result">{outputText || '—'}</div>
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


