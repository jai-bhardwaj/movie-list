import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@vercel/postgres";
import { getUserId, getMemberRole } from "@/lib/db";
import { can } from "@/lib/rbac";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getMemberRole(params.id, userId);
  if (!can(role, "inviteMember")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, role: inviteRole } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });
  if (!["admin", "editor", "viewer"].includes(inviteRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check if already a member
  const { rows: existing } = await sql`
    SELECT wm.id FROM workspace_members wm
    JOIN users u ON wm.user_id = u.id
    WHERE wm.workspace_id = ${params.id} AND u.email = ${email.trim()}
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: "User is already a member" }, { status: 400 });
  }

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await sql`
    INSERT INTO invitations (workspace_id, email, role, invited_by, token, expires_at)
    VALUES (${params.id}, ${email.trim()}, ${inviteRole}, ${userId}, ${token}, ${expiresAt})
  `;

  // If user already exists, auto-add them
  const { rows: existingUsers } = await sql`SELECT id FROM users WHERE email = ${email.trim()}`;
  if (existingUsers.length > 0) {
    await sql`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (${params.id}, ${existingUsers[0].id}, ${inviteRole})
      ON CONFLICT (workspace_id, user_id) DO NOTHING
    `;
    await sql`UPDATE invitations SET accepted = true WHERE token = ${token}`;
  }

  return NextResponse.json({ status: "ok", message: "Invitation sent" });
}
