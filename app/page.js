"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "./lib/supabase";
import AppShell from "./components/AppShell";

// ── Lazy-load heavy dashboard widgets (reduces initial JS by ~35KB) ───────────
const AnnouncementBoard = dynamic(() => import("./components/AnnouncementBoard"), {
  loading: () => <div className="skeleton h-32 rounded-2xl" />,
  ssr: false,
});
const ActivityLog = dynamic(() => import("./components/ActivityLog"), {
  loading: () => <div className="skeleton h-32 rounded-2xl" />,
  ssr: false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function toTitleCase(str) {
  if (!str) return '';
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, delta }) {
  const colors = {
    blue: { bg: "bg-blue-50 dark:bg-blue-500/10", icon: "text-blue-600 dark:text-blue-400", val: "text-blue-600 dark:text-blue-400" },
    indigo: { bg: "bg-indigo-50 dark:bg-indigo-500/10", icon: "text-indigo-600 dark:text-indigo-400", val: "text-[var(--on-surface)]" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/10", icon: "text-emerald-600 dark:text-emerald-400", val: "text-emerald-600 dark:text-emerald-400" },
    amber: { bg: "bg-amber-50 dark:bg-amber-500/10", icon: "text-amber-600 dark:text-amber-400", val: "text-amber-600 dark:text-amber-400" },
  };
  const c = colors[color] || colors.indigo;
  const positive = delta && !delta.startsWith("-");
  return (
    <div className="stat-card animate-fadeIn !p-4 sm:!p-6 flex items-center gap-3 sm:gap-4">
      <div className={`w-10 h-10 sm:w-11 sm:h-11 ${c.bg} rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <p className={`text-2xl sm:text-3xl font-black animate-countPop ${c.val}`}>{value}</p>
          {delta && (
            <span className={`text-[10px] sm:text-xs font-bold ${positive ? "text-emerald-500" : "text-red-500"}`}>
              {positive ? "▲" : "▼"} {delta}
            </span>
          )}
        </div>
        <p className="text-[10px] sm:text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Announcement hero card ──────────────────────────────────────────────────
function AnnouncementsSection() {
  return (
    <section>
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-0.5">Featured</p>
          <h2 className="text-2xl font-black text-[var(--on-surface)]">Important Announcements</h2>
        </div>
      </div>
      {/* AnnouncementBoard already handles its own data */}
      <AnnouncementBoard compact />
    </section>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function boot() {
      // Fetch current user for welcome banner
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to get rich profile data (first_name, username)
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, username")
          .eq("id", user.id)
          .single();
        setCurrentUser({
          firstName: profile?.first_name || user.user_metadata?.first_name || null,
          username: profile?.username || user.user_metadata?.username || null,
          email: user.email,
        });
      }

      // Auth is now handled by edge middleware — no client-side redirect needed
      const { data } = await supabase
        .from("shows")
        .select("*, show_participants(*)")
        .order("created_at", { ascending: true });
      setLogs(data || []);
      setLoading(false);
    }
    boot();

    // Auto-refresh every minute
    const t = setInterval(async () => {
      try { await fetch("/api/reset-status"); await fetch("/api/send-alerts"); } catch { }
    }, 60000);
    return () => clearInterval(t);
  }, [router]);

  // Set time-dependent values only on the client to avoid hydration mismatch
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
    setTodayLabel(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }));
  }, []);

  const totalShows = logs.length;
  const totalParticipants = logs.reduce((a, l) => a + (l.show_participants?.length || 0), 0);
  const checkedCount = logs.reduce((a, l) => a + (l.show_participants?.filter(p => p.status)?.length || 0), 0);
  const pendingCount = totalParticipants - checkedCount;
  const pct = n => totalParticipants > 0 ? ((n / totalParticipants) * 100).toFixed(1) + "%" : "0.0%";

  // Welcome banner helpers
  const displayName = currentUser?.firstName
    ? toTitleCase(currentUser.firstName)
    : currentUser?.username
    ? toTitleCase(currentUser.username)
    : currentUser?.email
    ? toTitleCase(currentUser.email.split("@")[0])
    : null;

  // greeting and todayLabel are set via useEffect above (client-only) to prevent hydration mismatch

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-10 py-6 sm:py-10 space-y-8 sm:space-y-10">

        {/* ── Welcome Banner ────────────────────────────────────── */}
        {displayName && (
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-700 p-6 sm:p-8 shadow-xl shadow-indigo-500/20">
            {/* Decorative blobs */}
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-6 w-40 h-40 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-violet-300/10 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-indigo-200 text-xs sm:text-sm font-semibold tracking-widest uppercase mb-1.5">
                  {greeting}
                </p>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                  Welcome back,{" "}
                  <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
                    {displayName}
                  </span>
                  {" "}👋
                </h1>
                <p className="text-indigo-200/70 text-xs sm:text-sm mt-2 font-medium">{todayLabel}</p>
              </div>

              {/* Quick action pill */}
              <Link
                href="/shows"
                className="inline-flex items-center gap-2 self-start sm:self-auto bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-bold px-4 py-2.5 rounded-xl border border-white/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                View Shows
              </Link>
            </div>
          </div>
        )}

        {/* ── Stats ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 stagger">
          <StatCard label="Total Shows" value={loading ? "—" : totalShows} color="indigo" delta={totalShows > 0 ? `${totalShows}` : undefined}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
          />
          <StatCard label="Participants" value={loading ? "—" : totalParticipants} color="blue"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
          <StatCard label="Checked In" value={loading ? "—" : checkedCount} color="emerald" delta={pct(checkedCount)}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard label="Pending" value={loading ? "—" : pendingCount} color="amber"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>

        {/* ── Content grid ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10 items-start">

          {/* Left: Announcements + Activity */}
          <div className="lg:col-span-2 space-y-8 sm:space-y-10">

            {/* Announcements */}
            <section>
              <div className="flex items-end justify-between mb-4 sm:mb-6">
                <div>
                  <p className="text-[11px] sm:text-xs font-bold text-[var(--on-surface-variant)] uppercase tracking-widest opacity-70 mb-1">Featured</p>
                  <h2 className="text-xl sm:text-2xl font-black text-[var(--on-surface)] tracking-tight">Important Announcements</h2>
                </div>
              </div>
              <AnnouncementBoard />
            </section>

            {/* Recent Activity */}
            <section>
              <div className="flex items-end justify-between mb-4 sm:mb-6">
                <div>
                  <p className="text-[11px] sm:text-xs font-bold text-[var(--on-surface-variant)] uppercase tracking-widest opacity-70 mb-1">Live Updates</p>
                  <h2 className="text-xl sm:text-2xl font-black text-[var(--on-surface)] tracking-tight">Recent Activity</h2>
                </div>
              </div>
              <ActivityLog />
            </section>
          </div>

          {/* Right: Shift widget + team stats */}
          <div className="space-y-6 sm:space-y-8 mt-4 lg:mt-0">

            {/* Last Seen Widget */}
            <p className="text-[11px] sm:text-sm font-bold text-[var(--on-surface-variant)] uppercase tracking-widest mb-3 opacity-70">Last seen</p>
            <h3 className="sr-only">Last Seen</h3>
            <LastSeenWidget />

            <h3 className="text-[11px] sm:text-xs font-bold text-[var(--on-surface-variant)] uppercase tracking-widest mt-8 mb-3 opacity-70">My Activity</h3>

            {/* Shift status card */}
            <ShiftWidget />

            {/* Progress summary */}
            <div className="bg-[var(--surface-container-lowest)] rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-[var(--outline-variant)]/20 dark:border-transparent hover:border-[var(--outline-variant)]/50 dark:hover:border-white/5 transition-all space-y-4">
              <h4 className="font-extrabold text-[var(--on-surface)] text-sm tracking-tight text-center">Show Progress</h4>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="skeleton h-4" />)}
                </div>
              ) : totalShows === 0 ? (
                <p className="text-sm text-[var(--on-surface-variant)]">No shows yet. <Link href="/add" className="text-blue-600 font-semibold hover:underline">Add one →</Link></p>
              ) : (
                <div className="space-y-4">
                  {logs.slice(0, 4).map(log => {
                    const participants = log.show_participants || [];
                    const checked = participants.filter(p => p.status).length;
                    const pct = participants.length > 0 ? Math.round((checked / participants.length) * 100) : 0;
                    return (
                      <Link key={log.id} href="/shows" className="block group p-2.5 -mx-2.5 rounded-xl hover:bg-[var(--surface-container-low)] transition-all">
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-sm font-semibold text-[var(--on-surface)] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{toTitleCase(log.name)}</p>
                          <span className="text-xs font-bold text-[var(--on-surface-variant)] ml-2 flex-shrink-0 opacity-80">{checked}/{participants.length}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--surface-container-high)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 shadow-[inset_0_-1px_1px_rgba(0,0,0,0.1)] ${pct === 100 ? "bg-emerald-500" : pct > 50 ? "bg-indigo-500" : "bg-amber-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                  {logs.length > 4 && (
                    <Link href="/shows" className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                      View all {logs.length} shows →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}

// ── Last Seen Widget ─────────────────────────────────────────────────────────
function LastSeenWidget() {
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, last_seen")
        .order("last_seen", { ascending: false, nullsFirst: false })
        .gt("last_seen", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(5);

      if (!data) return;

      const now = new Date();
      const mapped = data.map(d => {
        const lastSeen = new Date(d.last_seen);
        const isOnline = (now - lastSeen) < 3.5 * 60 * 1000;
        const name = toTitleCase(d.email ? d.email.split('@')[0] : `User ${d.id.slice(0, 6)}`);
        const color = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500"][(name.charCodeAt(0) || 0) % 4];
        return { name, time: d.last_seen, color, isOnline };
      });
      setRecentUsers(mapped);
    }

    load();
    const ch = supabase.channel("last-seen-profiles")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, payload => {
        load();
      })
      .subscribe();

    const poll = setInterval(load, 30000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, []);

  function formatRelative(dt) {
    const mins = Math.floor((Date.now() - new Date(dt).getTime()) / 60000);
    if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="bg-[var(--surface-container-lowest)] rounded-2xl py-3 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-[var(--outline-variant)]/20 dark:border-transparent">
      {recentUsers.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)] px-5 py-2">No users online.</p>
      ) : (
        <div className="flex flex-col">
          {recentUsers.map((u, i) => (
            <div key={i} className="flex items-center gap-2.5 hover:bg-[var(--surface-container-low)] px-5 py-2.5 transition-colors group cursor-default">
              <div className={`w-8 h-8 rounded-full ${u.color} flex items-center justify-center text-white text-xs font-bold shadow-sm relative`}>
                {u.name.charAt(0)}
                {u.isOnline && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--surface-container-lowest)] dark:border-transparent rounded-full z-10" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] sm:text-sm font-bold text-[var(--on-surface)] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{u.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {u.isOnline && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>}
                  <p className={`text-[11px] font-medium opacity-70 ${u.isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--on-surface-variant)]"}`}>
                    {u.isOnline ? "Active now" : formatRelative(u.time)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shift Widget ─────────────────────────────────────────────────────────────
function ShiftWidget() {
  const [shift, setShift] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { setLoading(false); return; }
      setUser(data.user);
      supabase.from("shift_logs").select("*")
        .eq("user_id", data.user.id)
        .in("status", ["active", "on_break"])
        .order("clock_in", { ascending: false })
        .limit(1)
        .then(({ data: rows }) => { setShift(rows?.[0] || null); setLoading(false); });
    });
  }, []);

  useEffect(() => {
    if (!shift?.clock_in) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(shift.clock_in).getTime()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [shift?.clock_in]);

  const fmt = s => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  async function clockIn() {
    if (!user) return;
    const { data } = await supabase.from("shift_logs").insert([{
      user_id: user.id, user_name: user.user_metadata?.first_name || user.email?.split("@")[0] || "User",
      user_email: user.email, clock_in: new Date().toISOString(), shift_date: new Date().toISOString().split("T")[0], status: "active"
    }]).select();
    if (data?.[0]) { setShift(data[0]); setElapsed(0); }
  }

  async function clockOut() {
    if (!shift) return;
    const clockOut = new Date();
    const totalMins = Math.floor((clockOut - new Date(shift.clock_in)) / 60000) - (shift.break_minutes || 0);
    await supabase.from("shift_logs").update({ clock_out: clockOut.toISOString(), total_hours: parseFloat((totalMins / 60).toFixed(2)), status: "completed" }).eq("id", shift.id);
    setShift(null);
  }

  return (
    <div className="app-card p-4 sm:p-5 relative overflow-hidden">
      {/* Decorative bg icon */}
      <div className="absolute top-0 right-0 p-3 opacity-5 dark:opacity-[0.03]">
        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" /></svg>
      </div>

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" /></svg>
            </div>
            <div className="sm:hidden">
              <p className="text-[10px] font-bold text-[var(--on-surface-variant)] uppercase tracking-widest">{shift ? "Active Session" : "Not Clocked In"}</p>
              <p className="text-2xl font-black text-[var(--on-surface)] font-mono">{shift ? fmt(elapsed) : "00:00:00"}</p>
            </div>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold text-[var(--on-surface-variant)] uppercase tracking-widest">{shift ? "Active Session" : "Not Clocked In"}</p>
            <p className="text-2xl font-black text-[var(--on-surface)] font-mono">{shift ? fmt(elapsed) : "00:00:00"}</p>
          </div>
        </div>

        {shift ? (
          <>
            <div className="space-y-3 mb-5">
              {[
                { label: "Shift Started", val: new Date(shift.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
                { label: "Break Time", val: `${shift.break_minutes || 0} min`, accent: true },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center py-2.5 border-b border-[var(--outline-variant)]/10 dark:border-transparent last:border-0">
                  <span className="text-sm text-[var(--on-surface-variant)]">{r.label}</span>
                  <span className={`text-sm font-bold ${r.accent ? "text-emerald-500" : "text-[var(--on-surface)]"}`}>{r.val}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/shift-log" className="flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border-2 border-[var(--outline-variant)]/20 dark:border-transparent dark:bg-[var(--surface-container-low)] hover:border-blue-500/40 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 transition-all group">
                <svg className="w-5 h-5 text-[var(--on-surface-variant)] group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                <span className="text-[10px] font-bold text-[var(--on-surface-variant)] group-hover:text-blue-600 dark:group-hover:text-blue-400 uppercase tracking-tighter">View Log</span>
              </Link>
              <button onClick={clockOut} className="flex flex-col items-center gap-1.5 p-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/80 text-red-500 hover:text-white border border-red-500/20 transition-all group active:scale-95">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                <span className="text-[10px] font-bold uppercase tracking-tighter">Clock Out</span>
              </button>
            </div>
          </>
        ) : (
          <button onClick={clockIn} className="w-full btn-primary flex items-center justify-center gap-2 text-sm btn-shiny">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" /></svg>
            Clock In
          </button>
        )}
      </div>
    </div>
  );
}
