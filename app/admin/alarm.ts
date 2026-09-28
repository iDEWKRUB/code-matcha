// เสียงแจ้งเตือนออเดอร์ใหม่ (หลังร้าน)
// เบราว์เซอร์ไม่ยอมให้เว็บส่งเสียงจนกว่าจะมีการกด/แตะหน้านั้น 1 ครั้ง → ต้องเรียก unlock() จาก event ของผู้ใช้

let ctx: AudioContext | null = null;

function audioCtx() {
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C();
  }
  return ctx;
}

export const isUnlocked = () => !!ctx && ctx.state === "running";

export async function unlock() {
  try {
    const c = audioCtx();
    if (c.state !== "running") await c.resume();
  } catch {}
  return isUnlocked();
}

// กริ่ง "ติ๊ง-ต่อง" 3 รอบ (เสียงสูง ชัด ผ่านตัวบีบเสียงให้ดังเต็มที่โดยไม่แตก)
export function chime() {
  const c = ctx;
  if (!c || c.state !== "running") return false;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 6;
  const master = c.createGain();
  master.gain.value = 1;
  master.connect(comp).connect(c.destination);
  const notes = [1318.5, 1046.5]; // E6 → C6
  for (let round = 0; round < 3; round++) {
    notes.forEach((freq, i) => {
      const t = c.currentTime + 0.05 + round * 0.95 + i * 0.34;
      for (const [type, amp] of [
        ["triangle", 0.9],
        ["square", 0.12],
        ["sine", 0.5],
      ] as const) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.value = type === "sine" ? freq * 2 : freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(type === "sine" ? amp * 0.3 : amp, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 0.75);
      }
    });
  }
  return true;
}

// แจ้งเตือนมุมจอ (ตอนเปิดแท็บอื่นอยู่) — ต้องขออนุญาตจากการกดของผู้ใช้
export function askNotify() {
  try {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  } catch {}
}

export function notify(count: number) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
    new Notification(`ออเดอร์ใหม่ ${count} รายการ`, { body: "CODE-MATCHA หลังร้าน · กดเพื่อเปิดดู", tag: "cm-new-order" }).onclick = () => window.focus();
  } catch {}
}
