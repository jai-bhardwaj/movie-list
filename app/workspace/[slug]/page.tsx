"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";

interface Movie {
  id: string;
  title: string;
  horror: boolean;
  watched: boolean;
  watched_at: string | null;
  sort_order: number;
}

export default function WorkspacePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { slug } = useParams();
  const [workspace, setWorkspace] = useState<any>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [isHorror, setIsHorror] = useState(false);
  const [watchedOpen, setWatchedOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const dragItem = useRef<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") loadWorkspace();
  }, [status, slug]);

  async function loadWorkspace() {
    // Get workspace by slug
    const wsRes = await fetch("/api/workspaces");
    const wsData = await wsRes.json();
    const ws = wsData.workspaces?.find((w: any) => w.slug === slug);
    if (!ws) { router.push("/dashboard"); return; }
    setWorkspace(ws);

    // Load movies
    const movRes = await fetch(`/api/workspaces/${ws.id}/movies`);
    const movData = await movRes.json();
    setMovies(movData.movies || []);
    setRole(movData.role || "viewer");
    setLoading(false);
  }

  const canEdit = role === "admin" || role === "editor";
  const unwatched = movies.filter(m => !m.watched);
  const watched = movies.filter(m => m.watched);
  const total = movies.length;
  const watchedCount = watched.length;
  const pct = total ? Math.round((watchedCount / total) * 100) : 0;

  async function addMovie() {
    if (!newTitle.trim() || !workspace) return;
    const title = newTitle.trim();
    setNewTitle("");
    // Optimistic add
    const tempMovie: Movie = { id: "temp-" + Date.now(), title, horror: isHorror, watched: false, watched_at: null, sort_order: movies.length };
    setMovies(prev => [...prev, tempMovie]);
    setIsHorror(false);
    setSyncing(true);
    await fetch(`/api/workspaces/${workspace.id}/movies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", title, horror: isHorror }),
    });
    // Reload to get real ID
    const res = await fetch(`/api/workspaces/${workspace.id}/movies`);
    const data = await res.json();
    setMovies(data.movies || []);
    setSyncing(false);
  }

  async function toggleMovie(movieId: string) {
    // Optimistic toggle
    setMovies(prev => prev.map(m => m.id === movieId ? { ...m, watched: !m.watched, watched_at: !m.watched ? new Date().toISOString() : null } : m));
    setSyncing(true);
    await fetch(`/api/workspaces/${workspace.id}/movies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", movieId }),
    });
    setSyncing(false);
  }

  async function handleDrop(targetIdx: number) {
    if (dragItem.current === null || dragItem.current === targetIdx) return;
    const newUnwatched = [...unwatched];
    const [dragged] = newUnwatched.splice(dragItem.current, 1);
    newUnwatched.splice(targetIdx, 0, dragged);
    // Rebuild full list: new unwatched order + watched
    const newMovies = [...newUnwatched, ...watched];
    setMovies(newMovies);
    dragItem.current = null;
    // Persist
    setSyncing(true);
    await fetch(`/api/workspaces/${workspace.id}/movies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", movieIds: newMovies.map(m => m.id) }),
    });
    setSyncing(false);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-muted">Loading workspace...</div></div>;
  }

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-muted hover:text-white text-sm">← Back</button>
          <h1 className="text-lg font-semibold">{workspace?.name}</h1>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-card border border-border text-gold-dim">{role}</span>
          {syncing && <span className="text-[10px] uppercase tracking-wider text-gold">saving...</span>}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`/workspace/${slug}/settings`)} className="text-xs text-muted hover:text-white uppercase tracking-wider">Settings</button>
          <button onClick={() => signOut()} className="text-xs text-muted hover:text-white uppercase tracking-wider">Sign Out</button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="flex gap-8 mb-6">
          <div><span className="text-2xl font-bold text-gold">{total}</span><span className="text-muted text-xs ml-2 uppercase tracking-wider">Total</span></div>
          <div><span className="text-2xl font-bold text-green">{watchedCount}</span><span className="text-muted text-xs ml-2 uppercase tracking-wider">Watched</span></div>
          <div><span className="text-2xl font-bold text-white">{total - watchedCount}</span><span className="text-muted text-xs ml-2 uppercase tracking-wider">Remaining</span></div>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted mb-2">
            <span>Progress</span><span>{pct}%</span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gold-dim to-gold rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Add movie form */}
        {canEdit && (
          <div className="flex gap-0 border border-border rounded-lg bg-card overflow-hidden mb-8 focus-within:border-gold-dim transition-colors">
            <input
              type="text"
              placeholder="Add a movie..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMovie()}
              className="flex-1 bg-transparent border-none outline-none text-white text-sm px-5 py-3.5 placeholder-muted"
            />
            <label className={`flex items-center gap-1.5 px-3 border-l border-border text-[10px] uppercase tracking-wider cursor-pointer transition-colors ${isHorror ? "text-horror" : "text-muted"}`}>
              <input type="checkbox" className="hidden" checked={isHorror} onChange={(e) => setIsHorror(e.target.checked)} />
              🔮 Horror
            </label>
            <button onClick={addMovie} className="bg-gold text-black px-5 text-xs font-medium uppercase tracking-wider hover:bg-yellow-400 transition-colors">
              + Add
            </button>
          </div>
        )}

        {/* Up Next section */}
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted mb-3 flex items-center gap-3">
          <span>Up Next <span className="text-gold">({unwatched.length})</span></span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="space-y-0.5 mb-10 min-h-[60px]">
          {unwatched.length === 0 && (
            <div className="text-center text-muted py-12 border border-dashed border-border rounded-lg">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm">All caught up! Add more movies above.</p>
            </div>
          )}
          {unwatched.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-4 py-3.5 bg-card border border-border border-l-[3px] border-l-transparent hover:border-l-gold hover:border-gold-dim transition-all cursor-pointer group"
              draggable={canEdit}
              onDragStart={() => { dragItem.current = i; }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("drag-over"); }}
              onDrop={(e) => { e.currentTarget.classList.remove("drag-over"); handleDrop(i); }}
            >
              {canEdit && (
                <div className="flex flex-col gap-0.5 opacity-20 group-hover:opacity-60 transition-opacity cursor-grab">
                  <span className="block w-3 h-0.5 bg-muted rounded" />
                  <span className="block w-3 h-0.5 bg-muted rounded" />
                  <span className="block w-3 h-0.5 bg-muted rounded" />
                </div>
              )}
              <div
                onClick={() => canEdit && toggleMovie(m.id)}
                className="w-5 h-5 border border-border rounded-sm flex items-center justify-center flex-shrink-0 hover:border-green transition-colors"
              />
              <span className="text-border text-xs w-5 text-right flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 text-sm truncate">{m.title}</span>
              {m.horror && <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-horror/15 text-horror border border-horror/30">Horror</span>}
            </div>
          ))}
        </div>

        {/* Watched section */}
        {watched.length > 0 && (
          <div className="mb-16">
            <button
              onClick={() => setWatchedOpen(!watchedOpen)}
              className="w-full flex items-center gap-3 border border-border rounded-lg px-4 py-3 text-[11px] uppercase tracking-wider text-muted hover:border-gold-dim hover:text-white transition-all mb-3"
            >
              <span className={`text-[8px] transition-transform ${watchedOpen ? "rotate-90" : ""}`}>▶</span>
              Already Watched <span className="text-gold-dim">({watched.length})</span>
            </button>
            {watchedOpen && (
              <div className="space-y-0.5">
                {watched.map((m, i) => (
                  <div
                    key={m.id}
                    onClick={() => canEdit && toggleMovie(m.id)}
                    className="flex items-center gap-3 px-4 py-3 bg-card border border-border border-l-[3px] border-l-green opacity-50 hover:opacity-70 transition-all cursor-pointer"
                  >
                    <div className="w-5 h-5 bg-green rounded-sm flex items-center justify-center text-black text-xs flex-shrink-0">✓</div>
                    <span className="flex-1 text-sm line-through text-muted truncate">{m.title}</span>
                    {m.horror && <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-horror/15 text-horror border border-horror/30">Horror</span>}
                    {m.watched_at && <span className="text-[10px] text-muted">{new Date(m.watched_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
