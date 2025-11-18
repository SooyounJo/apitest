import Head from 'next/head';
import dynamic from 'next/dynamic';

const ModelTester = dynamic(() => import('../components/ui'), {
	ssr: false
});

export default function HomePage() {
	return (
		<>
			<Head>
				<title>함께해요 해피 에이피아이</title>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta
					name="description"
					content="함께해요 해피 에이피아이 — Next.js 기반 모델 테스트 인터페이스"
				/>
			</Head>
			<ModelTester />
		</>
	);
}
