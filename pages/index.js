import dynamic from 'next/dynamic';

const RepasosApp = dynamic(() => import('../components/RepasosApp'), { ssr: false });

export default function Home() {
  return <RepasosApp />;
}
