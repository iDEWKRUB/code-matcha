// หมวดของขวัญและแบบรูปการ์ตูนของพรีเมียม (ใช้ได้ทั้งหน้าเว็บและเซิร์ฟเวอร์)
export const REWARD_CATEGORIES = [
  { id: "menu", label: "เครื่องดื่ม & อาหาร", hint: "แลกเมนูของร้าน" },
  { id: "merch", label: "ของพรีเมียม", hint: "แก้ว ตุ๊กตา พวงกุญแจ ชุดชง" },
] as const;
export type RewardCategory = (typeof REWARD_CATEGORIES)[number]["id"];

export const MERCH_LOOKS = [
  { id: "tumbler", label: "แก้วเก็บความเย็น" },
  { id: "keychain", label: "พวงกุญแจ" },
  { id: "plush", label: "ตุ๊กตา" },
  { id: "chasen", label: "ชุดชงมัทฉะ" },
  { id: "tote", label: "กระเป๋าผ้า" },
  { id: "gift", label: "กล่องของขวัญ" },
] as const;
export type MerchLook = (typeof MERCH_LOOKS)[number]["id"];
