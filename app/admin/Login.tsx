"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Seal from "../Seal";

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (r.ok) router.refresh();
    else setError((await r.json().catch(() => ({}))).error ?? "เข้าสู่ระบบไม่สำเร็จ");
  }

  return (
    <main className="login-bg">
      <form className="login-card" onSubmit={submit}>
        <Seal size={56} />
        <p className="login-jp">いらっしゃいませ</p>
        <h1>CODE-MACHA หลังร้าน</h1>
        <p className="login-sub">สำหรับบาริสต้าและเจ้าของร้าน</p>

        <label className="login-field">
          รหัสผ่าน
          <span className="pw">
            <input
              className="text"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
              {show ? "ซ่อน" : "แสดง"}
            </button>
          </span>
        </label>

        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <button className="login-btn" disabled={!password || busy}>
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
        <p className="login-foot">ล็อกอินค้างไว้ได้ 12 ชั่วโมง</p>
      </form>
    </main>
  );
}
