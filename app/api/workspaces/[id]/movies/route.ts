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
  if (!can(role, "viewMovies")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows } = await sql`
    SELECT id, title, horror, watched, watched_at, sort_order, added_by
    FROM movies WHERE workspace_id = ${params.id}
    ORDER BY sort_order ASC
  `;
  return NextResponse.json({ status: "ok", movies: rows, role });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await getUserId(session.user.email);
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = await getMemberRole(params.id, userId);
  const body = await req.json();
  const { action } = body;

  if (action === "add") {
    if (!can(role, "addMovie")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { title, horror } = body;
    const { rows } = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM movies WHERE workspace_id = ${params.id}`;
    await sql`
      INSERT INTO movies (workspace_id, title, horror, watched, sort_order, added_by)
      VALUES (${params.id}, ${title}, ${!!horror}, false, ${rows[0].next}, ${userId})
    `;
    return NextResponse.json({ status: "ok" });
  }

  if (action === "toggle") {
    if (!can(role, "toggleMovie")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { movieId } = body;
    const { rows } = await sql`SELECT watched FROM movies WHERE id = ${movieId} AND workspace_id = ${params.id}`;
    if (rows.length === 0) return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    const newWatched = !rows[0].watched;
    await sql`UPDATE movies SET watched = ${newWatched}, watched_at = ${newWatched ? new Date().toISOString() : null} WHERE id = ${movieId}`;
    return NextResponse.json({ status: "ok" });
  }

  if (action === "reorder") {
    if (!can(role, "reorderMovies")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { movieIds } = body; // array of movie IDs in new order
    if (!Array.isArray(movieIds)) return NextResponse.json({ error: "Invalid movieIds" }, { status: 400 });
    for (let i = 0; i < movieIds.length; i++) {
      await sql`UPDATE movies SET sort_order = ${i} WHERE id = ${movieIds[i]} AND workspace_id = ${params.id}`;
    }
    return NextResponse.json({ status: "ok" });
  }

  if (action === "delete") {
    if (!can(role, "deleteMovie")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { movieId } = body;
    await sql`DELETE FROM movies WHERE id = ${movieId} AND workspace_id = ${params.id}`;
    return NextResponse.json({ status: "ok" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
