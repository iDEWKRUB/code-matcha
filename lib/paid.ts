import "server-only";
import { orderUri } from "./flex";
import { pushCard } from "./line";
import { earnPoints, itemLines, pointsBalance, queueAhead, rowWhen, type OrderRow } from "./orders";
import { rewardReferral } from "./referral";

// ออเดอร์มัทฉะจ่ายแล้ว (ร้านกดยืนยัน หรือ SlipOK ตรวจผ่าน): ให้แต้ม + โบนัสเพื่อนชวน + แจ้งลูกค้าว่าเข้าคิวแล้ว
export async function afterMatchaPaid(o: OrderRow, auto = false) {
  const no = o.daily_no;
  const earned = await earnPoints(o);
  const bonus = await rewardReferral(o); // ออเดอร์แรกของเพื่อนที่ถูกชวน
  const [ahead, balance] = await Promise.all([queueAhead(o.pickup_date, o.pickup_time, no), pointsBalance(o.line_user_id)]);
  await pushCard(
    o.line_user_id,
    {
      tone: "matcha",
      title: "ร้านได้รับชำระเงินแล้ว",
      subtitle: `ออเดอร์ #${no} เข้าคิวเรียบร้อย${auto ? " (ตรวจสลิปอัตโนมัติ)" : ""}`,
      rows: [
        ["ออเดอร์", `#${no}`, true],
        ["วิธีรับ", rowWhen(o)],
        ...(o.promo_discount > 0 ? ([[`โค้ด ${o.promo_code}`, `−฿${o.promo_discount}`]] as [string, string][]) : []),
        ...(o.discount > 0 ? ([["ส่วนลดแต้ม", `−฿${o.discount}`]] as [string, string][]) : []),
        ["ยอดชำระ", `฿${o.total}`],
        ["คิวก่อนหน้า", ahead ? `${ahead} คิว` : "ไม่มี ทำต่อเลย"],
        ["แต้มสะสม", earned > 0 ? `+${earned} (รวม ${balance})` : `${balance} แต้ม`],
        ...(bonus > 0 ? ([["โบนัสเพื่อนชวน", `+${bonus} แต้ม`, true]] as [string, string, boolean][]) : []),
      ],
      items: itemLines(o.items),
      note: "ออเดอร์เสร็จเมื่อไรจะแจ้งทาง LINE อีกครั้ง",
      button: { label: "สั่งเพิ่ม", uri: orderUri() },
    },
    { name: o.customer_name, orderNo: no },
  );
  return { earned, ahead, balance };
}
