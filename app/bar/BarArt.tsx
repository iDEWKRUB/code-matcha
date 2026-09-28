import type { BarKind } from "@/lib/bar";

// การ์ตูนของในมาม่าบาร์ (ใช้เมื่อยังไม่มีรูปจริง)
export default function BarArt({ kind, size = 44 }: { kind: BarKind; size?: number }) {
  if (kind === "noodle")
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <rect x="6" y="10" width="36" height="28" rx="5" fill="#D9A441" />
        <rect x="6" y="10" width="36" height="7" rx="3" fill="#B8412C" />
        <path d="M12 24c3-3 5 3 8 0s5 3 8 0 5 3 8 0M12 30c3-3 5 3 8 0s5 3 8 0 5 3 8 0" fill="none" stroke="#FFF3D6" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  if (kind === "topping")
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <ellipse cx="24" cy="20" rx="17" ry="6" fill="#E9D8C4" />
        <path d="M7 20h34l-3 14a5 5 0 0 1-5 4H15a5 5 0 0 1-5-4Z" fill="#F7EFE3" stroke="#CFC6AF" strokeWidth="1.5" />
        <path d="M17 19c2-4 6-4 8-1M26 18c2-3 5-2 6 0" fill="none" stroke="#E07B5A" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="10" y="10" width="28" height="28" rx="8" fill="#C9DBAE" />
      <circle cx="24" cy="24" r="6" fill="#2F4A2A" />
    </svg>
  );
}
