import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST']);
		return res.status(405).json({ message: 'Method Not Allowed' });
	}

	try {
		const { label, model, system, prompt, output, usage } = req.body || {};
		if (!prompt) {
			return res.status(400).json({ message: 'Field "prompt" is required' });
		}

		const record = {
			timestamp: new Date().toISOString(),
			label: label || '',
			model: model || '',
			system: system || '',
			prompt: prompt || '',
			output: output || '',
			usage: {
				prompt_tokens: usage?.prompt_tokens ?? null,
				completion_tokens: usage?.completion_tokens ?? null,
				total_tokens: usage?.total_tokens ?? null
			}
		};

		// If Vercel KV credentials exist, store in KV (persistent in Vercel)
		const hasKV =
			process.env.KV_REST_API_URL &&
			process.env.KV_REST_API_TOKEN;

		if (hasKV) {
			const { kv } = await import('@vercel/kv');
			const key = process.env.KV_LOG_KEY || 'model-test:logs';
			await kv.rpush(key, JSON.stringify(record));
			return res.status(200).json({ ok: true, storage: 'kv', key });
		}

		// Block writes on Vercel without KV (read-only FS). Instruct to configure KV.
		const isVercel = !!process.env.VERCEL || !!process.env.NEXT_RUNTIME;
		if (isVercel) {
			return res.status(500).json({
				message:
					'Running on Vercel with read-only filesystem. Configure Vercel KV (KV_REST_API_URL, KV_REST_API_TOKEN) to enable persistent saves.'
			});
		}

		// Fallback for local/dev: Save into data/data.jsonl inside project
		const dirPath = path.join(process.cwd(), 'data');
		await fs.promises.mkdir(dirPath, { recursive: true });
		const filePath = path.join(dirPath, 'data.jsonl');
		const line = JSON.stringify(record) + '\n';
		await appendFileAtomic(filePath, line, 'utf8');
		return res.status(200).json({ ok: true, storage: 'file', filePath });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return res.status(500).json({ message });
	}
}

async function appendFileAtomic(filePath, data, encoding) {
	// Simple append; for local dev this is sufficient
	await fs.promises.appendFile(filePath, data, { encoding });
}


