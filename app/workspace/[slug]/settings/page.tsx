"use client";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Member {
  id: string;
  email: string;
  name: string;
  image: string;
  role: string;
  joined_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { slug } = useParams();
  const [workspace, setWorkspace] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [userRole, setUserRole] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") loadData();
  }, [status, slug]);

  async function loadData() {
    const wsRes = await fetch("/api/workspaces");
    const wsData = await wsRes.json();
    const ws = wsData.workspaces?.find((w: any) => w.slug === slug);
    if (!ws) { router.push("/dashboard"); return; }
    setWorkspace(ws);

    const memRes = await fetch(`/api/workspaces/${ws.id}/members`);
    const memData = await memRes.json();
    setMembers(memData.members || []);
    setInvitations(memData.invitations || []);
    setUserRole(memData.userRole || "viewer");
    setLoading(false);
  }

  async function invite() {
    if (!inviteEmail.trim() || !workspace) return;
    setInviting(true);
    setMessage("");
    const res = await fetch(`/api/workspaces/${workspace.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });
    const data = await res.json();
    if (data.error) {
      setMessage(data.error);
    } else {
      setMessage("Invitation sent!");
      setInviteEmail("");
      loadData();
    }
    setInviting(false);
  }

  async function changeRole(memberId: string, newRole: string) {
    await fetch(`/api/workspaces/${workspace.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, newRole }),
    });
    loadData();
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this member?")) return;
    await fetch(`/api/workspaces/${workspace.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    loadData();
  }

  const isAdmin = userRole === "admin";

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-muted">Loading...</div></div>;

  return (
    <div className="min-h-screen">
      <nav className="border-b border-border px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push(`/workspace/${slug}`)} className="text-muted hover:text-white text-sm">← Back to list</button>
        <h1 className="text-lg font-semibold">{workspace?.name} <span className="text-muted font-normal">/ Settings</span></h1>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Invite section */}
        {isAdmin && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold mb-1">Invite Members</h2>
            <p className="text-muted text-sm mb-4">Invited users get access when they sign in with the same email.</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Email address..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()}
                className="flex-1 bg-card border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-gold-dim"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="bg-card border border-border rounded-lg px-3 py-3 text-sm text-white outline-none"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={invite}
                disabled={inviting || !inviteEmail.trim()}
                className="bg-gold text-black px-6 py-3 rounded-lg text-sm font-medium hover:bg-yellow-400 disabled:opacity-50"
              >
                {inviting ? "..." : "Invite"}
              </button>
            </div>
            {message && <p className={`text-sm mt-2 ${message.includes("sent") ? "text-green" : "text-accent"}`}>{message}</p>}
          </div>
        )}

        {/* Members */}
        <h2 className="text-lg font-semibold mb-4">Members ({members.length})</h2>
        <div className="space-y-1 mb-10">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
              {m.image ? (
                <img src={m.image} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-xs text-muted flex-shrink-0">
                  {(m.name || m.email)[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                <p className="text-xs text-muted truncate">{m.email}</p>
              </div>
              {isAdmin ? (
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m.id, e.target.value)}
                  className="bg-surface border border-border rounded px-2 py-1 text-xs text-gold outline-none"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className="text-xs text-gold-dim uppercase tracking-wider">{m.role}</span>
              )}
              {isAdmin && m.email !== session?.user?.email && (
                <button onClick={() => removeMember(m.id)} className="text-accent text-xs hover:text-red-400">Remove</button>
              )}
            </div>
          ))}
        </div>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-4">Pending Invitations ({invitations.length})</h2>
            <div className="space-y-1">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 bg-card border border-dashed border-border rounded-lg px-4 py-3 opacity-60">
                  <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-xs text-muted">✉</div>
                  <div className="flex-1">
                    <p className="text-sm">{inv.email}</p>
                  </div>
                  <span className="text-xs text-gold-dim uppercase tracking-wider">{inv.role}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
