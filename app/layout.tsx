import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Show Check Log",
  description: "Monitor your show status",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans text-slate-800">
        {children}
        <Toaster 
          position="top-center"
          toastOptions={{
            className: '!bg-slate-900 !text-white !border !border-white/10 !shadow-2xl !rounded-xl !text-sm !font-medium',
            duration: 4000,
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}
