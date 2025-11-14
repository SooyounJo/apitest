import { google } from 'googleapis';

export default async function handler(req, res) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST']);
		return res.status(405).json({ message: 'Method Not Allowed' });
	}

	const {
		GOOGLE_SHEETS_CLIENT_EMAIL,
		GOOGLE_SHEETS_PRIVATE_KEY,
		GOOGLE_SHEETS_SPREADSHEET_ID,
		GOOGLE_SHEETS_SHEET_NAME
	} = process.env;

	if (!GOOGLE_SHEETS_CLIENT_EMAIL || !GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_SPREADSHEET_ID) {
		return res.status(500).json({
			message:
				'Missing Google Sheets credentials. Set GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID'
		});
	}

	const privateKey = GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n');
	const sheetName = GOOGLE_SHEETS_SHEET_NAME || 'Sheet1';

	const { label, model, system, prompt, output, usage } = req.body || {};
	if (!prompt) {
		return res.status(400).json({ message: 'Field "prompt" is required' });
	}

	try {
		const auth = new google.auth.JWT(
			GOOGLE_SHEETS_CLIENT_EMAIL,
			undefined,
			privateKey,
			['https://www.googleapis.com/auth/spreadsheets']
		);
		const sheets = google.sheets({ version: 'v4', auth });
		const timestamp = new Date().toISOString();

		const values = [
			timestamp,
			label || '',
			model || '',
			system || '',
			prompt || '',
			output || '',
			usage?.prompt_tokens ?? '',
			usage?.completion_tokens ?? '',
			usage?.total_tokens ?? ''
		];

		await sheets.spreadsheets.values.append({
			spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
			range: `${sheetName}!A1`,
			valueInputOption: 'RAW',
			insertDataOption: 'INSERT_ROWS',
			requestBody: {
				values: [values]
			}
		});

		return res.status(200).json({ ok: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return res.status(500).json({ message });
	}
}


