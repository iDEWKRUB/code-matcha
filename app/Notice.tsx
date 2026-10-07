import Icon from "./Icon";

// ประกาศสำคัญจากร้าน: กล่องสีส้มแดงใต้หัวหน้าเว็บ อ่านง่าย ไม่ปิดทิ้ง (ร้านตั้งเวลาหายเองได้)
export default function Notice({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="sn-notice" role="alert">
      <span className="sn-ico" aria-hidden="true">
        <Icon name="megaphone" size={20} />
      </span>
      <div>
        <b>ประกาศจากร้าน</b>
        <p>{text}</p>
      </div>
    </div>
  );
}
