"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  movie_count: number;
  member_count: number;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") loadWorkspaces();
  }, [status, router]);

  async function loadWorkspaces() {
    const res = await fetch("/api/workspaces");
    const data = await res.json();
    setWorkspaces(data.workspaces || []);
  }

  async function createWorkspace() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    if (data.workspace) {
      router.push(`/workspace/${data.workspace.slug}`);
    }
    setCreating(false);
    setNewName("");
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-muted">Loading...</div></div>;
  }

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Movie <span className="text-gold italic">Night</span></h1>
        <div className="flex items-center gap-4">
          <span className="text-muted text-sm">{session?.user?.email}</span>
          {session?.user?.image && (
            <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
          )}
          <button onClick={() => signOut()} className="text-xs text-muted hover:text-white transition-colors uppercase tracking-wider">
            Sign Out
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-2">Your Workspaces</h2>
        <p className="text-muted text-sm mb-8">Each workspace has its own movie list and team.</p>

        {/* Create workspace */}
        <div className="flex gap-2 mb-8">
          <input
            type="text"
            placeholder="New workspace name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
            className="flex-1 bg-card border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted outline-none focus:border-gold-dim transition-colors"
          />
          <button
            onClick={createWorkspace}
            disabled={creating || !newName.trim()}
            className="bg-gold text-black px-6 py-3 rounded-lg text-sm font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "+ Create"}
          </button>
        </div>

        {/* Workspace list */}
        <div className="space-y-2">
          {workspaces.length === 0 && (
            <div className="text-center text-muted py-16 border border-dashed border-border rounded-lg">
              <p className="text-3xl mb-3">🎬</p>
              <p>No workspaces yet. Create one to get started!</p>
            </div>
          )}
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => router.push(`/workspace/${w.slug}`)}
              className="w-full text-left bg-card border border-border rounded-lg p-5 hover:border-gold-dim hover:bg-card-hover transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white group-hover:text-gold transition-colors">{w.name}</h3>
                  <p className="text-muted text-xs mt-1">
                    {w.movie_count} movies · {w.member_count} members · <span className="text-gold-dim">{w.role}</span>
                  </p>
                </div>
                <span className="text-muted group-hover:text-gold transition-colors">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
