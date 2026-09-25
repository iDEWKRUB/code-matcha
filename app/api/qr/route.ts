import { orderQrSvg } from "@/lib/qr";

export async function GET() {
  return new Response(await orderQrSvg(), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
  });
}
