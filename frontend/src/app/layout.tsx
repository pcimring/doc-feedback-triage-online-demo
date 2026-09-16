import "./globals.css";

export const metadata = {
  title: "Doc Feedback Triage using Camunda - Live Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
