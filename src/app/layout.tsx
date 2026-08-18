import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VaultFoundry",
  description: "Email creation, asset management, and campaign delivery."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
