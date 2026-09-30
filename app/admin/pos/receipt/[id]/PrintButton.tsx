"use client";

import { useEffect } from "react";

// ปุ่มพิมพ์ใบเสร็จ (ไม่ออกในกระดาษ) · ?print=1 = สั่งพิมพ์ทันทีที่เปิด
export default function PrintButton({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <div className="rc-tools">
      <button onClick={() => window.print()}>พิมพ์ใบเสร็จ</button>
      <button onClick={() => window.close()}>ปิด</button>
    </div>
  );
}
