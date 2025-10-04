import Head from 'next/head'

export default function Home() {
  return (
    <>
      <Head>
        <title>OSINT V7 - Firebase + Vercel</title>
      </Head>
      <main style={{ padding: "2rem", fontFamily: "monospace" }}>
        <h1>✅ OSINT V7 Client (Next.js)</h1>
        <p>Firebase config is loaded via environment variables.</p>
      </main>
    </>
  )
}