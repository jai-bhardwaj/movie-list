import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { sql } from "@vercel/postgres";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      // Upsert user in database
      await sql`
        INSERT INTO users (email, name, image)
        VALUES (${user.email}, ${user.name || ""}, ${user.image || ""})
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, image = EXCLUDED.image
      `;
      // Auto-accept any pending invitations for this email
      const { rows: invites } = await sql`
        SELECT id, workspace_id, role FROM invitations
        WHERE email = ${user.email} AND accepted = false AND expires_at > NOW()
      `;
      if (invites.length > 0) {
        const { rows: users } = await sql`SELECT id FROM users WHERE email = ${user.email}`;
        const userId = users[0].id;
        for (const inv of invites) {
          await sql`
            INSERT INTO workspace_members (workspace_id, user_id, role)
            VALUES (${inv.workspace_id}, ${userId}, ${inv.role})
            ON CONFLICT (workspace_id, user_id) DO NOTHING
          `;
          await sql`UPDATE invitations SET accepted = true WHERE id = ${inv.id}`;
        }
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const { rows } = await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
        if (rows.length > 0) {
          (session.user as any).id = rows[0].id;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
