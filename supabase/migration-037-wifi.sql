-- Wi-Fi ท้ายใบเสร็จหน้าร้าน: ตั้งในหน้าแอดมิน > ตั้งค่า > ร้าน (ไม่เก็บรหัสในโค้ด)
alter table shop_settings add column if not exists wifi_ssid text not null default '' check (char_length(wifi_ssid) <= 64);
alter table shop_settings add column if not exists wifi_pass text not null default '' check (char_length(wifi_pass) <= 64);
