import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import FeedbackChatMount from "./FeedbackChatMount";

// Rubik, the face the Android app ships (mobile/.../res/font/rubik.ttf).
const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "מאגר התאוריה", template: "%s · מאגר התאוריה" },
  description: "כל 1,802 שאלות מאגר התאוריה הרשמי עם התשובה הנכונה, לוח התמרורים, תרגול ומבחן כמו האמיתי.",
};

export const viewport: Viewport = {
  themeColor: "#0e3380",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className="font-sans antialiased">
        {children}
        <FeedbackChatMount />
      </body>
    </html>
  );
}
