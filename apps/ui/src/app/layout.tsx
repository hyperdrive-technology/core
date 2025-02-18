import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import { TRPCProvider } from "../trpc/provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Inrush",
  description: "Industrial automation and control system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
