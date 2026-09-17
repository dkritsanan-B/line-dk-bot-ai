import type { Viewport } from "next";

// viewport-fit=cover ทำให้ env(safe-area-inset-*) มีค่าจริงบน iPhone — แถบแท็บล่างของ /admin เว้นขอบโฮมบาร์ได้
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
