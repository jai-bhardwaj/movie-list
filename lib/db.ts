import { sql } from "@vercel/postgres";

export async function setupDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      image TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(workspace_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
      invited_by UUID REFERENCES users(id),
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS movies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      horror BOOLEAN DEFAULT FALSE,
      watched BOOLEAN DEFAULT FALSE,
      watched_at TIMESTAMPTZ,
      sort_order INT NOT NULL DEFAULT 0,
      added_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function getUserId(email: string): Promise<string | null> {
  const { rows } = await sql`SELECT id FROM users WHERE email = ${email}`;
  return rows.length > 0 ? rows[0].id : null;
}

export async function getMemberRole(workspaceId: string, userId: string): Promise<string | null> {
  const { rows } = await sql`
    SELECT role FROM workspace_members
    WHERE workspace_id = ${workspaceId} AND user_id = ${userId}
  `;
  return rows.length > 0 ? rows[0].role : null;
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
