import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminListSessions, adminGetSessionLogs, adminLogin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Building2, LogOut, MessageSquare, RefreshCw, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Estate AI" }] }),
  component: AdminPage,
});

const TOKEN_KEY = "estate_admin_token";

function AdminPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
  }, []);

  if (!token) return <LoginScreen onLogin={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="font-serif text-lg font-semibold">Estate AI · Admin</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Live chat sessions</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">View site</Link>
            <button onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken(null); }}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <SessionsView token={token} />
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (t: string) => void }) {
  const login = useServerFn(adminLogin);
  const [username, setUsername] = useState("Admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await login({ data: { username, password } });
      onLogin(token);
    } catch (err) {
      toast.error((err as Error).message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Toaster richColors position="top-center" />
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-2xl font-semibold">Admin Sign In</h1>
          <p className="text-xs text-muted-foreground mt-1">Use <code className="rounded bg-secondary px-1">Admin</code> / <code className="rounded bg-secondary px-1">1111</code></p>
        </div>
        <input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Username"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="Password"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <button disabled={busy} type="submit" className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "…" : "Sign in"}
        </button>
        <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-foreground">← Back to site</Link>
      </form>
    </div>
  );
}

function SessionsView({ token }: { token: string }) {
  const list = useServerFn(adminListSessions);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: () => list({ data: { token } }),
    refetchInterval: 4000,
  });

  const sessions = data?.sessions ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4" /> Chat sessions
            <span className="text-xs text-muted-foreground">({sessions.length})</span>
          </div>
          <button onClick={() => refetch()} className="text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto divide-y divide-border">
          {sessions.map((s: any) => {
            const q = s.questionnaire ?? {};
            return (
              <button key={s.id} onClick={() => setSelected(s.id)}
                className={`block w-full text-left px-4 py-3 hover:bg-secondary/40 ${selected === s.id ? "bg-secondary/60" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate">
                    {q.customer_name || `Anonymous · ${s.id.slice(0, 8)}`}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{s.message_count} msg</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(s.created_at).toLocaleString()}
                </div>
                {(q.budget || q.location || q.customer_phone) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.budget && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px]">฿{Number(q.budget).toLocaleString()}</span>}
                    {q.location && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px]">{q.location}</span>}
                    {q.customer_phone && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px]">{q.customer_phone}</span>}
                  </div>
                )}
              </button>
            );
          })}
          {sessions.length === 0 && <div className="p-6 text-xs text-muted-foreground text-center">No sessions yet.</div>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {selected ? <SessionDetail token={token} sessionId={selected} /> : (
          <div className="grid h-full min-h-[400px] place-items-center text-sm text-muted-foreground">
            Select a session to view chat history
          </div>
        )}
      </div>
    </div>
  );
}

const FIELD_ORDER = ["customer_name", "customer_phone", "age", "occupation", "purpose", "budget", "location", "payment_type"] as const;

function SessionDetail({ token, sessionId }: { token: string; sessionId: string }) {
  const get = useServerFn(adminGetSessionLogs);
  const { data, isFetching } = useQuery({
    queryKey: ["admin-session", sessionId],
    queryFn: () => get({ data: { token, sessionId } }),
    refetchInterval: 3000,
  });

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const q = (data.session?.questionnaire ?? {}) as Record<string, any>;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Session</div>
            <div className="font-mono text-xs">{sessionId}</div>
          </div>
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? "animate-spin" : ""}`} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FIELD_ORDER.map((f) => (
            <div key={f} className="rounded-md bg-secondary/40 px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.replace("_", " ")}</div>
              <div className="text-xs font-medium truncate">{q[f] ? String(q[f]) : "—"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {data.logs.map((l: any) => (
          <div key={l.id} className={`flex ${l.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              l.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
            }`}>
              <div className="text-[10px] opacity-60 mb-1">{l.role} · {new Date(l.created_at).toLocaleTimeString()}</div>
              <div className="whitespace-pre-wrap">{l.content}</div>
              {l.filters_applied && Object.keys(l.filters_applied).length > 0 && (
                <pre className="mt-1 text-[10px] opacity-60">{JSON.stringify(l.filters_applied)}</pre>
              )}
            </div>
          </div>
        ))}
        {data.logs.length === 0 && <div className="text-xs text-muted-foreground text-center py-10">No messages yet.</div>}
      </div>
    </div>
  );
}
