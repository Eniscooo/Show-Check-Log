import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { Inter, Manrope } from 'next/font/google';
import "./globals.css";

const inter    = Inter({    subsets: ['latin'], variable: '--font-inter',    display: 'swap' });
const manrope  = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = {
  title: "Show Check Log — Operational Hub",
  description: "Team operations, show tracking, and shift management.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.variable} ${manrope.variable} font-sans antialiased min-h-screen`}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            className: '!bg-[var(--surface-container-lowest)] !text-[var(--on-surface)] !border !border-[var(--outline-variant)]/30 !shadow-2xl !rounded-2xl !text-sm !font-semibold',
            duration: 4000,
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}
