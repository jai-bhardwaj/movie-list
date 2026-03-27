import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@vercel/postgres";
import { getUserId, getMemberRole } from "@/lib/db";
import { can } from "@/lib/rbac";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getMemberRole(params.id, userId);
  if (!can(role, "viewMembers")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows: members } = await sql`
    SELECT wm.id, wm.role, wm.joined_at, u.email, u.name, u.image
    FROM workspace_members wm
    JOIN users u ON wm.user_id = u.id
    WHERE wm.workspace_id = ${params.id}
    ORDER BY wm.joined_at ASC
  `;

  const { rows: invites } = await sql`
    SELECT id, email, role, created_at, expires_at
    FROM invitations
    WHERE workspace_id = ${params.id} AND accepted = false AND expires_at > NOW()
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ members, invitations: invites, userRole: role });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getMemberRole(params.id, userId);
  if (!can(role, "removeMember")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { memberId } = await req.json();
  await sql`DELETE FROM workspace_members WHERE id = ${memberId} AND workspace_id = ${params.id}`;
  return NextResponse.json({ status: "ok" });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getMemberRole(params.id, userId);
  if (!can(role, "changeRole")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { memberId, newRole } = await req.json();
  if (!["admin", "editor", "viewer"].includes(newRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  await sql`UPDATE workspace_members SET role = ${newRole} WHERE id = ${memberId} AND workspace_id = ${params.id}`;
  return NextResponse.json({ status: "ok" });
}
