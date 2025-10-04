import Head from "next/head";
import Script from "next/script";
import firebaseConfig, { APP_ID } from "../firebaseConfig";

export default function Home() {
  return (
    <>
      <Head>
        <title>Sistem Pemrosesan Data OSINT V7</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="data:," />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.FIREBASE_CONFIG_JSON = \`${JSON.stringify(firebaseConfig)}\`;
              window.APP_ID = "${APP_ID}";
            `
          }}
        />
      </Head>

      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js" strategy="beforeInteractive" />
      <Script type="module" src="/osint-script.js" strategy="afterInteractive" />

      <main id="root" />
    </>
  );
}