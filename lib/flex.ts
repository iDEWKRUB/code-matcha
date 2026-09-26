import "server-only";
import { SHOP } from "./config";

// การ์ดแจ้งเตือน LINE (Flex Message) โทนเดียวกับร้าน

const TONE = {
  matcha: "#4b6b2f", // ยืนยัน / ปกติ
  ready: "#d9822b", // พร้อมรับ (เด่น)
  danger: "#c23b22", // ยกเลิก / ไม่ผ่าน
  amber: "#b7860b", // งานรอร้านทำ (กลุ่มพนักงาน)
} as const;
export type Tone = keyof typeof TONE;

type Row = [label: string, value: string, strong?: boolean];

export type Card = {
  tone: Tone;
  title: string;
  subtitle?: string;
  rows?: Row[];
  items?: string[]; // รายการอาหาร/เครื่องดื่ม (แสดงเป็นบรรทัด)
  note?: string; // ข้อความเล็กท้ายการ์ด
  button?: { label: string; uri: string };
  hero?: string; // รูปใหญ่ด้านบน (https) กดแล้วไปที่ลิงก์ของปุ่ม
};

const text = (t: string, o: Record<string, unknown> = {}) => ({ type: "text", text: t || " ", wrap: true, ...o });

export function bubble(c: Card) {
  const color = TONE[c.tone];
  const body: unknown[] = [];
  if (c.rows?.length)
    body.push({
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: c.rows.map(([label, value, strong]) => ({
        type: "box",
        layout: "baseline",
        spacing: "md",
        contents: [
          text(label, { size: "sm", color: "#6b7163", flex: 3 }),
          text(value, { size: "sm", color: strong ? color : "#1c2419", weight: strong ? "bold" : "regular", flex: 6, align: "end" }),
        ],
      })),
    });
  if (c.items?.length) {
    body.push({ type: "separator", margin: "lg", color: "#e3e6d8" });
    body.push({
      type: "box",
      layout: "vertical",
      spacing: "xs",
      margin: "lg",
      contents: [text("รายการ", { size: "xs", color: "#6b7163", weight: "bold" }), ...c.items.map((i) => text(i, { size: "sm", color: "#1c2419" }))],
    });
  }
  if (c.note) body.push(text(c.note, { size: "xs", color: "#6b7163", margin: "lg" }));

  // การ์ดมีรูป: รูปอยู่บนสุด หัวข้อย้ายมาไว้ต้น body แทนแถบหัวสี
  if (c.hero)
    body.unshift({
      type: "box",
      layout: "vertical",
      spacing: "xs",
      margin: "none",
      paddingBottom: c.rows?.length ? "12px" : "0px",
      contents: [
        text(c.title, { size: "xl", color: "#1c2419", weight: "bold" }),
        ...(c.subtitle ? [text(c.subtitle, { size: "md", color, weight: "bold" })] : []),
      ],
    });

  return {
    type: "bubble",
    size: "mega",
    ...(c.hero
      ? {
          hero: {
            type: "image",
            url: c.hero,
            size: "full",
            aspectRatio: "20:13",
            aspectMode: "cover",
            ...(c.button ? { action: { type: "uri", label: c.button.label, uri: c.button.uri } } : {}),
          },
        }
      : {
          header: {
            type: "box",
            layout: "vertical",
            backgroundColor: color,
            paddingAll: "18px",
            spacing: "xs",
            contents: [
              text("暗号  CODE-MACHA", { size: "xxs", color: "#ffffffbb", weight: "bold" }),
              text(c.title, { size: "lg", color: "#ffffff", weight: "bold" }),
              ...(c.subtitle ? [text(c.subtitle, { size: "sm", color: "#ffffffdd" })] : []),
            ],
          },
        }),
    body: { type: "box", layout: "vertical", paddingAll: "18px", backgroundColor: "#fbfcf6", contents: body.length ? body : [text(" ")] },
    ...(c.button
      ? {
          footer: {
            type: "box",
            layout: "vertical",
            paddingAll: "12px",
            backgroundColor: "#fbfcf6",
            contents: [{ type: "button", style: "primary", color, height: "sm", action: { type: "uri", label: c.button.label, uri: c.button.uri } }],
          },
        }
      : {}),
    styles: { footer: { separator: true } },
  };
}

// ข้อความสำรองสำหรับการแจ้งเตือน/แอปที่แสดงการ์ดไม่ได้ (สูงสุด 400 ตัวอักษร)
export function altText(c: Card) {
  return [c.title, ...(c.rows ?? []).map(([l, v]) => `${l}: ${v}`)].join(" · ").slice(0, 400);
}

export const orderUri = () => {
  const id = process.env.NEXT_PUBLIC_LIFF_ID;
  return id ? `https://liff.line.me/${id}` : SHOP.siteUrl;
};
export const adminUri = () => `${SHOP.siteUrl}/admin`;
