// อ่าน QR ทุกอันจากรูปถาดรูปเดียว (zxing-wasm; ไฟล์ .wasm อยู่ใน public/ ของเราเอง)
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";

prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/${path}` : prefix + path) },
});

export type Found = { text: string; x: number; y: number; w: number; h: number };
// bad = จุดที่เจอ QR แต่อ่านไม่ออก (เบลอ ยับ แสงสะท้อน) → ให้ถ่ายใหม่
export type TrayScan = { codes: Found[]; bad: Found[]; width: number; height: number; photo: string };

const center = (b: Found) => [b.x + b.w / 2, b.y + b.h / 2];
const overlaps = (a: Found, b: Found) => {
  const [ax, ay] = center(a);
  const [bx, by] = center(b);
  return Math.abs(ax - bx) < Math.max(a.w, b.w) / 2 && Math.abs(ay - by) < Math.max(a.h, b.h) / 2;
};

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
    returnErrors: true,
  });
  const codes: Found[] = [];
  const bad: (Found & { minSide: number; square: boolean })[] = [];
  for (const r of results) {
    const p = r.position;
    const xs = [p.topLeft.x, p.topRight.x, p.bottomLeft.x, p.bottomRight.x];
    const ys = [p.topLeft.y, p.topRight.y, p.bottomLeft.y, p.bottomRight.y];
    const box = { text: r.text, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    if (box.w < 8 || box.h < 8) continue;
    if (r.isValid && r.text) {
      // กันอ่านชิ้นเดียวกันซ้ำ (จุดกลางทับกัน)
      if (!codes.some((o) => o.text === box.text && overlaps(o, box))) codes.push(box);
    } else {
      const corners = [p.topLeft, p.topRight, p.bottomRight, p.bottomLeft];
      const sides = corners.map((a, i) => Math.hypot(corners[(i + 1) % 4].x - a.x, corners[(i + 1) % 4].y - a.y));
      bad.push({ ...box, minSide: Math.min(...sides), square: Math.max(...sides) / Math.min(...sides) < 1.5 });
    }
  }
  // จุดที่อ่านไม่ออกที่นับจริง: รูปทรงเกือบสี่เหลี่ยมจัตุรัส ขนาดใกล้ QR จริงในรูป และไม่ทับ QR ที่อ่านได้
  // (ลายบนซองบางแบบหน้าตาคล้ายมุม QR แต่รูปทรงเบี้ยว/เล็กกว่า)
  const sizes = codes.map((o) => Math.min(o.w, o.h)).sort((a, b) => a - b);
  const minSide = sizes.length ? sizes[Math.floor(sizes.length / 2)] * 0.6 : 24;
  const real = bad
    .filter((b) => b.square && b.minSide >= minSide && !codes.some((o) => overlaps(o, b)))
    .filter((b, i, arr) => !arr.slice(0, i).some((o) => overlaps(o, b)))
    .map(({ text, x, y, w, h }) => ({ text, x, y, w, h }));
  return { codes, bad: real, canvas: c };
}

export async function scanTray(file: Blob): Promise<TrayScan> {
  const bmp = await createImageBitmap(file);
  let { codes, bad, canvas } = await readAt(bmp, 2000);
  // เจอน้อย/อ่านไม่ออก ลองความละเอียดสูงขึ้นอีกรอบ (สติ๊กเกอร์เล็กในรูปกว้าง)
  if ((codes.length < 2 || bad.length) && Math.max(bmp.width, bmp.height) > 2000) {
    const hi = await readAt(bmp, 3200);
    if (hi.codes.length > codes.length || (hi.codes.length === codes.length && hi.bad.length < bad.length)) ({ codes, bad, canvas } = hi);
  }
  // ย่อรูปไว้แสดง + ส่งเป็นหลักฐาน (กรอบ QR คิดเป็นสัดส่วนของรูป)
  const view = document.createElement("canvas");
  const s = Math.min(1, 1400 / Math.max(canvas.width, canvas.height));
  view.width = Math.round(canvas.width * s);
  view.height = Math.round(canvas.height * s);
  view.getContext("2d")!.drawImage(canvas, 0, 0, view.width, view.height);
  return { codes, bad, width: canvas.width, height: canvas.height, photo: view.toDataURL("image/jpeg", 0.82) };
}
