import { useCallback, useMemo, useState } from 'react';

const DEFAULT_MODELS = [
	{ id: 'gpt-4o', label: 'gpt-4o (smarter)' },
	{ id: 'gpt-4o-mini', label: 'gpt-4o-mini (faster/cheaper)' }
];

export default function ModelTester() {
	const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[0].id);
	const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
	const [userPrompt, setUserPrompt] = useState('');
	const [label, setLabel] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [outputText, setOutputText] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [tokenUsage, setTokenUsage] = useState(null);
	const [isSavingLocal, setIsSavingLocal] = useState(false);
	const [saveLocalMessage, setSaveLocalMessage] = useState('');

	const isSubmitDisabled = useMemo(() => {
		return isLoading || userPrompt.trim().length === 0;
	}, [isLoading, userPrompt]);

	const handleSubmit = useCallback(
		async (event) => {
			event.preventDefault();
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
		},
		[isSubmitDisabled, selectedModel, systemPrompt, userPrompt]
	);

	const handleClear = useCallback(() => {
		setUserPrompt('');
		setLabel('');
		setOutputText('');
		setErrorMessage('');
		setTokenUsage(null);
	}, []);

	const handleSaveToLocal = useCallback(async () => {
		setSaveLocalMessage('');
		setIsSavingLocal(true);
		try {
			const response = await fetch('/api/saveLocal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					label: (label && label.trim()) || deriveLabel(userPrompt),
					model: selectedModel,
					system: systemPrompt,
					prompt: userPrompt,
					output: outputText,
					usage: tokenUsage
				})
			});
			const payload = await safeJson(response);
			if (!response.ok) {
				throw new Error(payload?.message || `Save failed (${response.status})`);
			}
			if (payload?.storage === 'kv') {
				setSaveLocalMessage(`Saved: KV ${payload.key}`);
			} else {
				setSaveLocalMessage(`Saved: ${payload?.filePath || 'local file'}`);
			}
		} catch (err) {
			setSaveLocalMessage(err instanceof Error ? err.message : 'Save error');
		} finally {
			setIsSavingLocal(false);
		}
	}, [label, outputText, selectedModel, systemPrompt, tokenUsage, userPrompt]);

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

					<label style={{ display: 'block', marginBottom: 12 }}>
						<div className="sectionTitle">Label (optional)</div>
						<input
							className="input"
							placeholder="짧은 제목/라벨을 입력하세요 (미입력 시 프롬프트로 요약)"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
						/>
					</label>

					<label>
						<div className="sectionTitle">System Prompt</div>
						<textarea
							className="textarea"
							placeholder="Set the assistant behavior..."
							value={systemPrompt}
							onChange={(e) => setSystemPrompt(e.target.value)}
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
							onClick={handleSaveToLocal}
							disabled={isSavingLocal || !outputText}
							title="프롬프트/결과를 로컬 파일(JSONL)에 저장"
						>
							{isSavingLocal ? 'Saving…' : '앵간 프롬프트 저장'}
						</button>
					</div>
					<div className="footerNote">
						Set your API key in <code>.env.local</code>. Required: <code>OPENAI_API_KEY</code>.
						Optional: <code>OPENAI_BASE_URL</code>.
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
				{saveLocalMessage && (
					<div
						className="footerNote"
						style={{ marginTop: 8, color: saveLocalMessage.includes('Saved') ? '#22c55e' : 'var(--danger)' }}
					>
						{saveLocalMessage}
					</div>
				)}
			</section>
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


