import { Archivo, IBM_Plex_Mono } from "next/font/google";

// Motorsport voice: condensed-weight Archivo (italic for display headers),
// tabular IBM Plex Mono for every telemetry numeral.
export const display = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const tel = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-tel",
});
