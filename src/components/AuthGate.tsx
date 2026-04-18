"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ADMIN_AUTH_STORAGE_KEY } from "@/lib/auth-storage";

type GateStatus = "checking" | "authed" | "unauthed";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validateStoredToken = useCallback(async () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
    if (!token) {
      setStatus("unauthed");
      return;
    }
    try {
      const res = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStatus("authed");
        return;
      }
    } catch {
      // network error — treat as unauthed
    }
    localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    setStatus("unauthed");
  }, []);

  useEffect(() => {
    void validateStoredToken();
  }, [validateStoredToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "Sign-in failed.");
        return;
      }
      if (!data.token) {
        setError("No token returned.");
        return;
      }
      localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, data.token);
      setPassword("");
      setStatus("authed");
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-[#f8fafc] dark:bg-[#020617]">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (status === "unauthed") {
    return (
      <div className="relative flex min-h-full flex-1 flex-col items-center justify-center bg-[#f8fafc] px-4 py-12 dark:bg-[#020617]">
        <div className="fixed inset-0 pointer-events-none opacity-20 dark:opacity-40">
          <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-blue-400 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-10%] h-[30%] w-[30%] rounded-full bg-indigo-400 blur-[100px]" />
        </div>
        <Card className="relative z-10 w-full max-w-md border-slate-200/80 bg-white/90 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary p-2 shadow-lg shadow-blue-500/20">
              <Briefcase className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">JobsPH AI</CardTitle>
            <CardDescription>Enter the admin password to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="h-11"
              />
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="h-11 w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
