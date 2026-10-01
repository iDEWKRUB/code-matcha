import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // QR อวยพรบนแก้ว → หน้า "มีของขวัญในแก้วของคุณ" (ไฟล์ HTML เดี่ยวใน public/)
  async rewrites() {
    return [{ source: "/gift", destination: "/gift.html" }];
  },
};

export default nextConfig;
