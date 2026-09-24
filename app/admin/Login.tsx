"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Seal from "../Seal";

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState("");
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
    <form className="login" onSubmit={submit}>
      <h1>
        <Seal size={36} /> หน้าบาริสต้า
      </h1>
      <input
        className="text"
        type="password"
        autoComplete="current-password"
        placeholder="รหัสผ่าน"
        aria-label="รหัสผ่าน"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="primary" disabled={!password || busy}>เข้าสู่ระบบ</button>
      {error && <p className="err" role="alert">{error}</p>}
    </form>
  );
}
