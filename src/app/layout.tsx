import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/layout/app-providers";
import { TopBar } from "@/components/layout/top-bar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Travel App",
  description: "Solicitação de viagens corporativas — pré-viagem",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AppProviders>
          <TopBar />
          <main className="mx-auto max-w-6xl px-14 py-10">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
