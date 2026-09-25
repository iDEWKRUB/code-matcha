// สร้างข้อความ QR พร้อมเพย์ (มาตรฐาน EMVCo / Thai QR) พร้อมยอดเงิน

const tlv = (id: string, value: string) => id + String(value.length).padStart(2, "0") + value;

function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// id: เบอร์มือถือ (10 หลัก) หรือเลขบัตรประชาชน/ผู้เสียภาษี (13 หลัก)
export function promptPayPayload(id: string, amount?: number) {
  const digits = id.replace(/\D/g, "");
  const target =
    digits.length >= 13 ? tlv("02", digits) : tlv("01", ("0000000000000" + digits.replace(/^0/, "66")).slice(-13));
  const payload =
    tlv("00", "01") +
    tlv("01", amount ? "12" : "11") +
    tlv("29", tlv("00", "A000000677010111") + target) +
    tlv("58", "TH") +
    tlv("53", "764") +
    (amount ? tlv("54", amount.toFixed(2)) : "") +
    "6304";
  return payload + crc16(payload);
}
