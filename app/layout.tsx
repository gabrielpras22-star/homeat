import type { Metadata } from "next";
import { Italiana, Manrope } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import Effects from "./components/site/Effects";

const italiana = Italiana({
  variable: "--font-italiana",
  subsets: ["latin"],
  weight: "400",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shareat — Tables d'hôtes chez l'habitant",
  description: "Réservez une place chez un hôte près de chez vous : cuisine maison et rencontres.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${italiana.variable} ${manrope.variable}`}>
      <body>
        <Effects />
        {children}
      </body>
    </html>
  );
}
