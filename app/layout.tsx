import type { Metadata } from "next";
import "./globals.css";
import FeedbackChatMount from "./FeedbackChatMount";

export const metadata: Metadata = {
  title: "theoryBank",
  description: "All 1802 official theory-test questions with the correct answer, offline",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}
        <FeedbackChatMount />
</body>
    </html>
  );
}
