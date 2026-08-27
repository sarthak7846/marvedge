import "./globals.css";
import { SonnerToaster } from "./components/sonner-toaster";
import { Providers } from "./providers";
import { Caveat, Inter, Poppins, Raleway, Roboto } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-raleway",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-caveat",
});

export const metadata = {
  title: "Marvedge",
  description: "Turn Clicks Into Customers with Interactive Demos",
  icons: {
    icon: "/icons/Transparent logo.png",
  },
};

export const viewport = "width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`overflow-x-hidden ${raleway.variable} ${inter.variable} ${roboto.variable} ${poppins.variable} ${caveat.variable}`}
    >
      <body className="overflow-x-hidden bg-white" suppressHydrationWarning>
        <Providers>
          {children}
          <SonnerToaster />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
