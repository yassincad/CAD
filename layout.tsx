import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "CAD OFPPT | لجنة الانضباط الذاتي",
  description: "بوابة لجنة الانضباط الذاتي للمتدربين",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}