// ย่อรูปให้ด้านยาวไม่เกิน maxSide เป็น JPG แล้วอัปโหลดเข้า bucket "promo" → คืนลิงก์สาธารณะ
export async function uploadImage(file: File, maxSide = 600): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; // PNG พื้นใสให้เป็นพื้นขาว
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("แปลงรูปไม่สำเร็จ"))), "image/jpeg", 0.85));
  const fd = new FormData();
  fd.append("image", blob, "photo.jpg");
  const r = await fetch("/api/admin/promo-image", { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "อัปโหลดไม่สำเร็จ");
  return j.url as string;
}
