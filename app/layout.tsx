import type { Metadata } from "next";
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
      </body>
    </html>
  );
}
