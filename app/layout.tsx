import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NavBar } from "./components/NavBar";
import { getSession } from "@/lib/auth";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ArcaOS — Diagnóstico Empresarial",
  description: "Diagnóstico 360, plano de ação e execução para PMEs.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="pt-BR" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen flex flex-col print:min-h-0 print:block">
        <NavBar session={session} />
        <div className="flex-1 print:block">
          {children}
        </div>
      </body>
    </html>
  );
}
