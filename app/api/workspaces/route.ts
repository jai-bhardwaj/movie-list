import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@vercel/postgres";
import { getUserId, slugify } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { rows } = await sql`
    SELECT w.id, w.name, w.slug, wm.role,
      (SELECT COUNT(*) FROM movies WHERE workspace_id = w.id) AS movie_count,
      (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) AS member_count
    FROM workspaces w
    JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = ${userId}
    ORDER BY w.created_at DESC
  `;
  return NextResponse.json({ workspaces: rows });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);

  const { rows } = await sql`
    INSERT INTO workspaces (name, slug, created_by)
    VALUES (${name.trim()}, ${slug}, ${userId})
    RETURNING id, slug
  `;
  const workspaceId = rows[0].id;

  // Creator becomes admin
  await sql`
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (${workspaceId}, ${userId}, 'admin')
  `;

  return NextResponse.json({ status: "ok", workspace: rows[0] });
}
