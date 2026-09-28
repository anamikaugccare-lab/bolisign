import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'बोली-साइन (BoliSign) — Indian Sign Language to Hindi Speech',
  description: 'AI-powered real-time Indian Sign Language interpreter, custom sign trainer, and Hindi speech synthesizer for the Deaf & Mute community.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* MediaPipe Hands v0.4 exact version with all dependencies */}
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.4/camera_utils.js" crossOrigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.4/drawing_utils.js" crossOrigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js" crossOrigin="anonymous"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
