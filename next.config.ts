import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ปิดป้ายมุมจอของ Next ตอน dev — ไม่งั้นมันติดไปในภาพที่ผู้ตรวจใช้ตัดสินงานออกแบบ
  devIndicators: false,
};

export default nextConfig;
