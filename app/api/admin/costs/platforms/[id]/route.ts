import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { costsPayload } from "@/lib/costsServer";
import { db } from "@/lib/supabase";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { error } = await db().from("gp_platforms").delete().eq("id", Number((await params).id));
  if (error) throw error;
  return NextResponse.json(await costsPayload());
}
