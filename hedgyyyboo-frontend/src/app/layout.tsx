import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export const metadata: Metadata = {
  title: 'Hedgyyyboo - Institutional Research Terminal',
  description:
    'Institutional-grade hedge fund research terminal. Real-time market intelligence, PCA risk decomposition, regime analysis, and AI-driven portfolio insights.',
  keywords: [
    'hedge fund',
    'research terminal',
    'portfolio management',
    'risk analysis',
    'PCA',
    'LDA',
    'market intelligence',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${jetbrainsMono.variable} font-mono antialiased bg-terminal-black text-hf-white grid-bg`}
      >
        <div className="scanline-overlay" />
        {children}
      </body>
    </html>
  );
}
