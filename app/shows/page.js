"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import AppShell from "../components/AppShell";
import ShowTable from "../components/ShowTable";
import PromoCodesModal from "../components/PromoCodesModal";
import Link from "next/link";

export default function ShowsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function boot() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setAuthChecked(true);
      fetchLogs();
    }
    boot();
    const t = setInterval(async () => {
      try { await fetch("/api/reset-status"); await fetch("/api/send-alerts"); } catch { }
    }, 60000);
    return () => clearInterval(t);
  }, [router]);

  async function fetchLogs() {
    const { data, error } = await supabase
      .from("shows")
      .select("*, show_participants(*)")
      .order("created_at", { ascending: true });
    setLogs(error ? [] : (data || []));
    setLoading(false);
  }

  if (!authChecked) return null;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--on-surface)] tracking-tight">Check Log System</h1>
            <p className="text-xs sm:text-sm text-[var(--on-surface-variant)] mt-0.5">Manage your show logs and monitor dates.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsPromoModalOpen(true)}
              className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              <span className="hidden sm:inline">Promo Codes</span>
              <span className="sm:hidden">Promos</span>
            </button>
            <Link href="/add">
              <button className="btn-primary btn-shiny flex items-center gap-1.5 text-xs sm:text-sm">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" /></svg>
                Add Show
              </button>
            </Link>
          </div>
        </div>

        {/* Table card */}
        <div className="app-card overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--on-surface-variant)]">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading shows…</p>
            </div>
          ) : (
            <ShowTable logs={logs} />
          )}
        </div>

      </div>

      <PromoCodesModal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        logs={logs}
        fetchLogs={fetchLogs}
      />
    </AppShell>
  );
}
