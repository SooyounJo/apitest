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

		const payload = { model, messages };

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
		const output =
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


