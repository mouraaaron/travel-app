import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/layout/app-providers";
import { AppSidebar } from "@/components/layout/app-sidebar";
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
          <AppSidebar />
          <main className="min-h-screen lg:pl-[248px]">
            <div className="px-6 pb-16 pt-8">{children}</div>
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
