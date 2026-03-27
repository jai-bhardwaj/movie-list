import { NextResponse } from "next/server";
import { setupDatabase } from "@/lib/db";

export async function GET() {
  try {
    await setupDatabase();
    return NextResponse.json({ status: "ok", message: "Database tables created successfully." });
  } catch (err: any) {
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}
