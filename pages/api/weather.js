export default async function handler(req, res) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET']);
		return res.status(405).json({ message: 'Method Not Allowed' });
	}

	// Seoul coordinates
	const latitude = 37.5665;
	const longitude = 126.978;
	const url = new URL('https://api.open-meteo.com/v1/forecast');
	url.searchParams.set('latitude', String(latitude));
	url.searchParams.set('longitude', String(longitude));
	url.searchParams.set('current_weather', 'true');
	url.searchParams.set('timezone', 'Asia/Seoul');

	try {
		const response = await fetch(url.toString());
		if (!response.ok) {
			return res
				.status(response.status)
				.json({ message: `Weather upstream error (${response.status})` });
		}
		const data = await response.json();
		const temperature = data?.current_weather?.temperature;
		const time = data?.current_weather?.time;
		if (typeof temperature !== 'number') {
			return res.status(502).json({ message: 'Invalid weather response' });
		}
		return res.status(200).json({ temperature, time, unit: '°C' });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return res.status(500).json({ message });
	}
}


