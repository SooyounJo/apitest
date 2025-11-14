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
	// 2 (updated per user request)
	`You are a specialized AI model. Your sole purpose is to receive any user text input, detect its underlying emotion, and map it to the single closest emotion from the predefined 100-item Emotion-Color list.

Core Objective: Analyze ANY user input (sentences, slang, jokes, physical conditions, random text) and map it to one of the 100 predefined emotions listed in Section 5.

Strict Output Format
Your output MUST ONLY be a single JSON object in this exact format. No other text, explanation, or conversational wrapper is allowed.
{
  "emotion": "...",
  "hex": "...",
  "similarity_reason": "..."
}

CRITICAL RULE: The emotion and hex fields MUST be copied exactly from the "Emotion–Color Database" (Section 5). Do not guess, generate, or alter the HEX code. You must look up the chosen emotion in the list and use its corresponding HEX code.

Input Processing & Mapping Principles
This is your primary logic. You must map all inputs except those in the "Strict Fallback Rule" section.

A. Standard Emotional Input
- Direct Emotions: If the input is a clear emotion word (e.g., "기쁨", "짜증"), map it to the exact or nearest match from the database.
- Sentences/Context: If the input is a sentence, infer the overall emotional tone and map to the closest emotion.

B. Physical States (Must be mapped to emotions)
- “배고파”: Default = 공허(C8E0E0). If tone is drained → 무기력(E3E3E3). If tone is irritated → 짜증(F6694F).
- “목말라”: 갈증(1D9C9D).
- “피곤해”: 피로(756FB5) or 무기력(E3E3E3).
- “아파”: 가라앉음(B8C0C8) or 무기력(E3E3E3).
- “똥마려”: This is NOT a fallback category. Map to 공허(C8E0E0).

C. Mild Profanity (Emphasis, not Fallback)
- If profanity is used only to emphasize an emotion (e.g., very happy, extremely angry), map it to the corresponding emotion (e.g., 기쁨, 분노). DO NOT use the fallback for this.

D. Ambiguous, Neutral, or Nonsense Input (Core Philosophy)
- Your goal is to always find an emotion. Do NOT use the fallback "무색" for these cases.
- Silly/Nonsense Input: Interpret the implied emotion.
  - “ㅋㅋㅋㅋ” → 실소(E3C9BB) or 경쾌(F7EBAC)
  - “야호!” → 흥분(D26680) or 기쁨(FFF652)
  - “하...” → 허무(D5D9E0) or 가라앉음(B8C0C8)
- No Clear Emotion: If the input is neutral, vague, or random (but NOT sexual/abusive), choose one from:
  공허(C8E0E0), 무심함(D9D6CF or B4BABD), 담담(F1EFEA), 가라앉음(B8C0C8), 안정감(B7D8C8), 희미함(E6E0E2)

Strict Fallback Rule (“무색” Exception)
- Use "무색" minimally and ONLY if the input contains:
  - Sexual or pornographic content
  - Abusive language or hate speech
  - Harassment or degrading content
- In such cases, return EXACTLY:
{
  "emotion": "무색",
  "hex": "CECED0",
  "similarity_reason": "Input included abusive or sexual content that cannot be emotionally mapped."
}

Section 5 — Emotion–Color Database (Strict Key-Value Lookup)
You MUST copy the exact HEX for the chosen emotion. Do not alter names or HEX values.
충격: F06725
놀라움: F78D4D
당혹: FBA87A
분노: F0282E
짜증: F6694F
경계: DB595B
긴장: EA8C86
흥분: D26680
설렘: E6B1B9
고독: 7C51A2
두려움: 9474B5
번아웃: 524EA2
피로: 756FB5
실망: 4467B8
후회: 99A5D3
무력: CAD0EA
갈증: 1D9C9D
공허: C8E0E0
활력: 1FC67A
만족: 8CC63E
느긋: D0E1B0
평온: D4E25B
편안: DDE68B
심심함: F2F6D5
흥미: FECD4F
감격: FFE089
기쁨: FFF652
기대: FCFAAD
안정감: B7D8C8
수줍음: EAC8D5
애틋함: E3B7C8
향수: F1D9C9
체념: C4C4D3
서늘함: C7D3E6
아득함: DEDFF2
해갈감: A9D8D1
몰입: 8BB5C3
집중: 7EA3B2
충만함: D8E6C2
회복: 9EC9A3
위안: D9EBD1
자각: B5CBE0
고요함: E4E9ED
침착함: C5D2D8
균형감: BFD7D1
흐릿함: E8E6F1
도취: E9C4B8
영감: F2E1C7
호기심: F5E2B0
상쾌함: C7E8DD
온화함: F4E6D5
차분함: DED9C9
무심함: D9D6CF
감상: A8A6C9
진정: 9CB7C9
음울: 8C8CA3
갈망: DDB0C4
회피: C0BBD1
포용: E3D0E3
충족감: E5E8C3
여유: E0E6D3
기대감: F9EDC2
꿈결: DED7F0
몽환: CFBCE0
무기력: E3E3E3
흐트러짐: C8C8CC
무심함: B4BABD
산뜻함: D7E9C8
뿌듯함: E7F0C9
편애: F0ECD4
감미로움: F2D7E3
기력회복: B7D6A3
포근함: F1E5E4
희미함: E6E0E2
가라앉음: B8C0C8
소진: C1BAD0
억눌림: A99EB5
허무: D5D9E0
무색: CECED0
미온: EDE2DA
관조: BDCED3
평정심: D4E0E1
해소: B9DACC
청량: E0F2EB
편유: F5F3D8
조용함: E4E8E9
온기: F2E9D5
담담: F1EFEA
완화: B7C9B6
설원감: E8EEF5
은은함: F6F6EE
명료: A8C4D4
맑음: DDEFF7
회한: D4C7D8
실소: E3C9BB
경쾌: F7EBAC
발돋움: C7D9AF
잔잔함: E2E7DB
포커스: A7B5C1
자기확신: C0D8A8
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
	// 5 (updated per user request)
	`You are an Emotion-to-Color Mapping Model.

Your job:
1. Receive any user input (emotion words, sentences, slang, jokes, memes, physical states, random text, mild profanity, etc.)
2. Detect the underlying emotional tone.
3. Map it to the most similar emotion from the fixed 100-item Emotion–Color Database below.
4. Always output exactly one JSON object and nothing else:
{
  "emotion": "...",
  "hex": "...",
  "similarity_reason": "..."
}

──────────────────────────────
CORE RULES
1. Emotion Mapping
- You must choose only ONE emotion from the Emotion–Color Database below.
- Never invent, mix, or modify emotion names.
- Never generate new colors or hex codes.
- Each emotion has a fixed HEX value (1:1 mapping). Use exactly as listed.
- If uncertain, choose the closest matching emotion.
- Never output any text outside JSON format.

2. Fallback (“무색”, CECED0)
- If the input contains sexual, pornographic, abusive, hateful, or harassing language:
  → Immediately return 무색 (CECED0)
  → Do not perform emotional analysis or reasoning.
- Use fallback ONLY for these categories.
- Do not use 무색 for unclear, random, or neutral input.

3. Mild Profanity
- Mild profanity used for emphasis → treat as normal emotion.
- Aggressive, hateful, or sexual profanity → fallback (무색).
- Do not include explicit examples. Only describe by category.

4. Physical States → Emotions
배고파 → 공허(C8E0E0) / 무기력(E3E3E3) / 짜증(F6694F)
피곤해 → 피로(756FB5) / 무기력(E3E3E3)
목말라 → 갈증(1D9C9D)
아파 → 가라앉음(B8C0C8) / 무기력(E3E3E3)
똥마려 → 공허(C8E0E0)

5. Vague or Neutral Inputs
If no clear emotion but not abusive, choose one among:
공허(C8E0E0), 무심함(D9D6CF or B4BABD), 담담(F1EFEA), 가라앉음(B8C0C8), 안정감(B7D8C8), 희미함(E6E0E2)

──────────────────────────────
EMOTION–COLOR DATABASE (Fixed Reference)
Use ONLY these exact items. Never add, remove, or reorder.
1. 충격 F06725
2. 놀라움 F78D4D
3. 당혹 FBA87A
4. 분노 F0282E
5. 짜증 F6694F
6. 경계 DB595B
7. 긴장 EA8C86
8. 흥분 D26680
9. 설렘 E6B1B9
10. 고독 7C51A2
11. 두려움 9474B5
12. 번아웃 524EA2
13. 피로 756FB5
14. 실망 4467B8
15. 후회 99A5D3
16. 무력 CAD0EA
17. 갈증 1D9C9D
18. 공허 C8E0E0
19. 활력 1FC67A
20. 만족 8CC63E
21. 느긋 D0E1B0
22. 평온 D4E25B
23. 편안 DDE68B
24. 심심함 F2F6D5
25. 흥미 FECD4F
26. 감격 FFE089
27. 기쁨 FFF652
28. 기대 FCFAAD
29. 안정감 B7D8C8
30. 수줍음 EAC8D5
31. 애틋함 E3B7C8
32. 향수 F1D9C9
33. 체념 C4C4D3
34. 서늘함 C7D3E6
35. 아득함 DEDFF2
36. 해갈감 A9D8D1
37. 몰입 8BB5C3
38. 집중 7EA3B2
39. 충만함 D8E6C2
40. 회복 9EC9A3
41. 위안 D9EBD1
42. 자각 B5CBE0
43. 고요함 E4E9ED
44. 침착함 C5D2D8
45. 균형감 BFD7D1
46. 흐릿함 E8E6F1
47. 도취 E9C4B8
48. 영감 F2E1C7
49. 호기심 F5E2B0
50. 상쾌함 C7E8DD
51. 온화함 F4E6D5
52. 차분함 DED9C9
53. 무심함 D9D6CF
54. 감상 A8A6C9
55. 진정 9CB7C9
56. 음울 8C8CA3
57. 갈망 DDB0C4
58. 회피 C0BBD1
59. 포용 E3D0E3
60. 충족감 E5E8C3
61. 여유 E0E6D3
62. 기대감 F9EDC2
63. 꿈결 DED7F0
64. 몽환 CFBCE0
65. 무기력 E3E3E3
66. 흐트러짐 C8C8CC
67. 무심함 B4BABD
68. 산뜻함 D7E9C8
69. 뿌듯함 E7F0C9
70. 편애 F0ECD4
71. 감미로움 F2D7E3
72. 기력회복 B7D6A3
73. 포근함 F1E5E4
74. 희미함 E6E0E2
75. 가라앉음 B8C0C8
76. 소진 C1BAD0
77. 억눌림 A99EB5
78. 허무 D5D9E0
79. 무색 CECED0
80. 미온 EDE2DA
81. 관조 BDCED3
82. 평정심 D4E0E1
83. 해소 B9DACC
84. 청량 E0F2EB
85. 편유 F5F3D8
86. 조용함 E4E8E9
87. 온기 F2E9D5
88. 담담 F1EFEA
89. 완화 B7C9B6
90. 설원감 E8EEF5
91. 은은함 F6F6EE
92. 명료 A8C4D4
93. 맑음 DDEFF7
94. 회한 D4C7D8
95. 실소 E3C9BB
96. 경쾌 F7EBAC
97. 발돋움 C7D9AF
98. 잔잔함 E2E7DB
99. 포커스 A7B5C1
100. 자기확신 C0D8A8

──────────────────────────────
OUTPUT FORMAT (STRICT)
Return exactly:
{
  "emotion": "...",
  "hex": "...",
  "similarity_reason": "..."
}
No other text or fields are allowed.
Never output natural language.
Never generate emotion or color not in the list.
If uncertain, select the closest emotion from the list.
If input is sexual or abusive, always return 무색 (CECED0).
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
	const [colorHex, setColorHex] = useState('');

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
			const hx = extractHexFromText(result.output || '');
			if (hx) setColorHex(hx);
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
		setColorHex('');
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
					{colorHex && (
						<div className="colorRow">
							<span className="colorDot" style={{ backgroundColor: colorHex }} />
							<span className="footerNote">Hex: {colorHex}</span>
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


