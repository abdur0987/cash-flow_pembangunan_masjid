import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cash Flow Pembangunan Masjid",
  description:
    "Monitoring cash flow pembangunan masjid Kanwil Kementerian Agama Provinsi Lampung.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
