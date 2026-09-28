// นับผู้เข้าชมหน้าเว็บลูกค้า: ใช้ LINE userId ถ้ามี ไม่งั้นใช้รหัสสุ่มที่จำไว้ในเครื่อง
export type TrackEvent = "visit" | "view_item" | "add_cart" | "order";

let visitorId: string | null = null;

// เรียกหลังล็อกอิน LINE เพื่อให้คนเดิมนับเป็นคนเดียวแม้เปลี่ยนเครื่อง
export function setVisitor(id: string) {
  visitorId = id;
}

function anonId() {
  try {
    let id = localStorage.getItem("cm-vid");
    if (!id) {
      id = `a-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem("cm-vid", id);
    }
    return id;
  } catch {
    return `a-${Math.random().toString(36).slice(2)}`;
  }
}

export function track(event: TrackEvent, page: "order" | "member" = "order") {
  try {
    const body = JSON.stringify({ event, page, id: visitorId ?? anonId() });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/track", blob)) {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {}
}
