import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });

  const formData = await req.formData();
  const file = formData.get("logo") as File | null;
  if (!file) return NextResponse.json(apiError("No file provided", "VALIDATION_ERROR"), { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(apiError("Only PNG, JPG, WebP and SVG are allowed", "VALIDATION_ERROR"), { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(apiError("File too large (max 2 MB)", "VALIDATION_ERROR"), { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${user.id}/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from("logos")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadErr) {
    return NextResponse.json(apiError(uploadErr.message, "INTERNAL_ERROR"), { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);

  // Bust cache by appending a timestamp
  const logo_url = `${publicUrl}?t=${Date.now()}`;

  await supabase
    .from("profiles")
    .update({ logo_url, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.json(apiSuccess({ logo_url }));
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(apiError("Unauthorized", "UNAUTHORIZED"), { status: 401 });

  // Remove all logo files for this user
  const { data: files } = await supabase.storage.from("logos").list(user.id);
  if (files?.length) {
    await supabase.storage.from("logos").remove(files.map((f) => `${user.id}/${f.name}`));
  }

  await supabase
    .from("profiles")
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.json(apiSuccess({ logo_url: null }));
}
