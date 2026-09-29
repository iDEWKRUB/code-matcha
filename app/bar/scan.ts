// อ่าน QR ทุกอันจากรูปถาดรูปเดียว (zxing-wasm; ไฟล์ .wasm อยู่ใน public/ ของเราเอง)
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";

prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/${path}` : prefix + path) },
});

export type Found = { text: string; x: number; y: number; w: number; h: number };
export type TrayScan = { codes: Found[]; width: number; height: number; photo: string };

async function readAt(bmp: ImageBitmap, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const results = await readBarcodes(ctx.getImageData(0, 0, c.width, c.height), {
    formats: ["QRCode"],
    maxNumberOfSymbols: 60,
    tryHarder: true,
    tryRotate: true,
    tryDownscale: true,
  });
  const codes: Found[] = [];
  for (const r of results) {
    if (!r.isValid || !r.text) continue;
    const p = r.position;
    const xs = [p.topLeft.x, p.topRight.x, p.bottomLeft.x, p.bottomRight.x];
    const ys = [p.topLeft.y, p.topRight.y, p.bottomLeft.y, p.bottomRight.y];
    const box = { text: r.text, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    // กันอ่านชิ้นเดียวกันซ้ำ (จุดกลางทับกัน)
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    if (codes.some((o) => o.text === box.text && Math.abs(o.x + o.w / 2 - cx) < o.w / 2 && Math.abs(o.y + o.h / 2 - cy) < o.h / 2)) continue;
    codes.push(box);
  }
  return { codes, canvas: c };
}

export async function scanTray(file: Blob): Promise<TrayScan> {
  const bmp = await createImageBitmap(file);
  let { codes, canvas } = await readAt(bmp, 2000);
  // เจอน้อย/ไม่เจอ ลองความละเอียดสูงขึ้นอีกรอบ (สติ๊กเกอร์เล็กในรูปกว้าง)
  if (codes.length < 2 && Math.max(bmp.width, bmp.height) > 2000) {
    const hi = await readAt(bmp, 3200);
    if (hi.codes.length > codes.length) ({ codes, canvas } = hi);
  }
  // ย่อรูปไว้แสดง + ส่งเป็นหลักฐาน (กรอบ QR คิดเป็นสัดส่วนของรูป)
  const view = document.createElement("canvas");
  const s = Math.min(1, 1400 / Math.max(canvas.width, canvas.height));
  view.width = Math.round(canvas.width * s);
  view.height = Math.round(canvas.height * s);
  view.getContext("2d")!.drawImage(canvas, 0, 0, view.width, view.height);
  return { codes, width: canvas.width, height: canvas.height, photo: view.toDataURL("image/jpeg", 0.82) };
}
