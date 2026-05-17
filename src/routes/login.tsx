import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminLogin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Admin sign in — Estate AI" }] }),
  component: LoginPage,
});

const TOKEN_KEY = "estate_admin_token";

function LoginPage() {
  const nav = useNavigate();
  const login = useServerFn(adminLogin);
  const [username, setUsername] = useState("Admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await login({ data: { username, password } });
      localStorage.setItem(TOKEN_KEY, token);
      nav({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Toaster richColors position="top-center" />
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.15)]"
      >
        <div className="text-center">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Estate AI Admin</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sign in to manage listings & sessions
          </p>
        </div>
        <div className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Username"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            placeholder="Password"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
          />
        </div>
        <button
          disabled={busy}
          type="submit"
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <div className="text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to site
          </Link>
        </div>
      </form>
    </div>
  );
}
