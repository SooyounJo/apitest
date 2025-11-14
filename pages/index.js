import Head from 'next/head';
import dynamic from 'next/dynamic';

const ModelTester = dynamic(() => import('../components/ModelTester'), {
	ssr: false
});

export default function HomePage() {
	return (
		<>
			<Head>
				<title>Open API Model Test</title>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta
					name="description"
					content="Next.js JS starter with an OpenAI-like model test interface"
				/>
			</Head>
			<ModelTester />
		</>
	);
}


