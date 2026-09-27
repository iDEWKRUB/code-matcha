import type { Powder } from "@/lib/menu";
import MatchaTin from "./MatchaTin";

// ระดับสีกระป๋อง: เรียงตามราคาบวกต่อกรัม (ผงถูกสุด = อ่อน, แพงสุด = เข้ม/ทอง)
export function powderTone(p: Pick<Powder, "id" | "extraPerGram">, all: Pick<Powder, "id" | "extraPerGram">[]) {
  const ranks = [...new Set(all.map((x) => x.extraPerGram))].sort((a, b) => a - b);
  const r = ranks.indexOf(p.extraPerGram);
  return ranks.length <= 1 ? 1 : Math.round((r / (ranks.length - 1)) * 3);
}

// รูปผงมัทฉะตัวเล็ก: รูปจริงถ้ามี ไม่งั้นกระป๋องการ์ตูน
export default function PowderThumb({ powder, tone, size = 28 }: { powder: Pick<Powder, "imageUrl" | "name">; tone: number; size?: number }) {
  return (
    <span className="pw-thumb" style={{ width: size, height: size }}>
      {powder.imageUrl ? <img src={powder.imageUrl} alt="" loading="lazy" /> : <MatchaTin tone={tone} size={size} />}
    </span>
  );
}
