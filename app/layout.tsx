import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DK วัสดุก่อสร้าง — เหล็ก เครื่องมือช่าง เมทัลชีท ท่อ PVC ปั๊มน้ำ เครื่องยนต์",
  description:
    "ร้าน DK วัสดุก่อสร้าง จำหน่ายเหล็ก เครื่องมือช่าง เมทัลชีท ท่อ PVC ปั๊มน้ำ และเครื่องยนต์ บริการดี ราคาดี มีระบบสะสมแต้ม",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Noto Sans Thai', sans-serif", background: "#F8FAFC" }}>
        {children}
      </body>
    </html>
  );
}
