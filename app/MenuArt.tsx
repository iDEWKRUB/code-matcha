import { lookOf, type MenuItem } from "@/lib/menu";
import Cup, { tintOf } from "./Cup";
import Food, { FOOD_TINT } from "./Food";

// ภาพการ์ตูนของเมนู: เครื่องดื่มใช้ถ้วย อาหารใช้จาน/กล่อง
export function artTint(item: Pick<MenuItem, "id" | "look" | "kind">) {
  return item.kind === "food" ? FOOD_TINT[lookOf(item)] ?? "#fff0c2" : tintOf(lookOf(item));
}

export default function MenuArt({ item, size, toppings }: { item: MenuItem; size: number; toppings?: string[] }) {
  return item.kind === "food" ? (
    <Food look={lookOf(item)} toppings={toppings} size={size} />
  ) : (
    <Cup itemId={lookOf(item)} temp={item.temps[0]} milk={item.milk ? "fresh" : null} size={size} />
  );
}
