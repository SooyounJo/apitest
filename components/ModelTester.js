import { useCallback, useEffect, useMemo, useState } from 'react';

const DEFAULT_MODELS = [
	{ id: 'gpt-4o', label: 'gpt-4o (smarter)' },
	{ id: 'gpt-4o-mini', label: 'gpt-4o-mini (faster/cheaper)' }
];

export default function ModelTester() {
	const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0].id);
	const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
	const [userPrompt, setUserPrompt] = useState('');
	const [presets, setPresets] = useState([
		{ id: 'slot1', text: 'You are a helpful assistant.' },
		{ id: 'slot2', text: '' },
		{ id: 'slot3', text: '' },
		{ id: 'slot4', text: '' },
		{ id: 'slot5', text: '' }
	]);
	const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [outputText, setOutputText] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [tokenUsage, setTokenUsage] = useState(null);
	const [isCopying, setIsCopying] = useState(false);
	const [copyMessage, setCopyMessage] = useState('');

	// Load/save presets to localStorage
	useEffect(() => {
		try {
			if (typeof window === 'undefined') return;
			// prefer v3 (5 slots); fallback to v2/v1
			const v3 = localStorage.getItem('system-presets-v3');
			if (v3) {
				const parsed = JSON.parse(v3);
				if (Array.isArray(parsed) && parsed.length > 0) {
					setPresets(normalizeToFive(parsed));
					return;
				}
			}
			const v2 = localStorage.getItem('system-presets-v2');
			if (v2) {
				const parsed = JSON.parse(v2);
				if (Array.isArray(parsed) && parsed.length > 0) {
					setPresets(normalizeToFive(parsed));
					return;
				}
			}
			const v1 = localStorage.getItem('system-presets-v1');
			if (v1) {
				const parsedV1 = JSON.parse(v1);
				if (Array.isArray(parsedV1) && parsedV1.length > 0) {
					setPresets(
						normalizeToFive(parsedV1.map((p, i) => ({ id: `slot${i + 1}`, text: p?.text || '' })))
					);
				}
			}
		} catch {}
	}, []);

	useEffect(() => {
		try {
			if (typeof window !== 'undefined') {
				localStorage.setItem('system-presets-v3', JSON.stringify(presets));
			}
		} catch {}
	}, [presets]);

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
	}, []);

	const handleSelectSlot = useCallback(
		(index) => {
			const slot = presets[index];
			if (slot?.text && slot.text.trim().length > 0) {
				setSystemPrompt(slot.text);
				setSelectedPresetIndex(index);
				setCopyMessage('');
			} else {
				// 빈 슬롯 선택 시 현 상태를 유지하되 선택 표시만 변경
				setSelectedPresetIndex(index);
				setCopyMessage('');
			}
		},
		[presets]
	);

	const handleCopySystem = useCallback(async () => {
		setCopyMessage('');
		setIsCopying(true);
		try {
			const text = String(systemPrompt || '');
			await copyToClipboard(text);
			setCopyMessage('Copied system prompt');
		} catch (err) {
			setCopyMessage('Copy failed');
		} finally {
			setIsCopying(false);
		}
	}, [systemPrompt]);

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
				<div className="title">Open API Model Test</div>
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
							{presets.map((p, i) => (
								<button
									key={p.id}
									type="button"
									className={`presetBtn presetBtnNumber ${selectedPresetIndex === i ? 'presetBtnActive' : ''}`}
									onClick={() => handleSelectSlot(i)}
									title={`슬롯 ${i + 1} 선택`}
									aria-pressed={selectedPresetIndex === i}
								>
									{i + 1}
								</button>
							))}
						</div>
						<textarea
							className="textarea"
							placeholder="Set the assistant behavior..."
							value={systemPrompt}
							onChange={(e) => {
								const val = e.target.value;
								setSystemPrompt(val);
								setPresets((prev) =>
									prev.map((p, idx) => (idx === selectedPresetIndex ? { ...p, text: val } : p))
								);
							}}
						/>
					</label>
				</section>

				<section className="panel section">
					<div className="sectionTitle">Prompt</div>

					<textarea
						className="textarea"
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
							onClick={handleClear}
						>
							Clear
						</button>
						<button
							type="button"
							className="button buttonSecondary"
							onClick={handleCopySystem}
							disabled={isCopying || !systemPrompt.trim()}
							title="시스템 프롬프트 내용을 클립보드로 복사"
						>
							{isCopying ? 'Copying…' : '앵간 프롬프트 copy'}
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
				</section>
			</form>

			<section className="panel section" style={{ marginTop: 16 }}>
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

			{copyMessage && (
				<div
					className="footerNote"
					style={{ marginTop: 12, color: '#22c55e' }}
				>
					{copyMessage}
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


