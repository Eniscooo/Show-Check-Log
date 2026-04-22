"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import AppShell from "../components/AppShell";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso) { return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"; }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString([], { weekday:"short", month:"short", day:"numeric" }) : "—"; }
function secToHHMM(sec) { const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60); return `${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m`; }

function StatusBadge({ status }) {
  const map = { active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", on_break: "bg-amber-500/10 text-amber-600 dark:text-amber-400", completed: "bg-[var(--surface-container)] text-[var(--on-surface-variant)]" };
  const labels = { active:"● Active", on_break:"⏸ On Break", completed:"✓ Completed" };
  return <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${map[status] || map.completed}`}>{labels[status] || status}</span>;
}

// ── Weekly report summary ─────────────────────────────────────────────────────
function WeeklyReport({ shifts }) {
  const now   = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
  const weekShifts = shifts.filter(s => s.status === "completed" && new Date(s.clock_in) >= start);
  const totalHrs   = weekShifts.reduce((a, s) => a + (s.total_hours || 0), 0);
  const totalBreak = weekShifts.reduce((a, s) => a + (s.break_minutes || 0), 0);
  const days = [...new Set(weekShifts.map(s => s.shift_date))].length;

  return (
    <div className="app-card p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">This Week</p>
          <h3 className="text-xl font-black text-[var(--on-surface)]">Weekly Report</h3>
        </div>
        <button
          onClick={() => {
            const escapeCSV = (str) => `"${String(str ?? '').replace(/"/g, '""')}"`;
            
            const rows = [
              [escapeCSV("Weekly Shift Invoice")],
              [escapeCSV("Generated:"), escapeCSV(new Date().toLocaleString())],
              [escapeCSV("Total Days Worked:"), days],
              [escapeCSV("Total Break Time (min):"), totalBreak],
              [],
              ["Date", "Log In Time", "Log Out Time", "Break (mins)", "Hours Worked", "Notes"].map(escapeCSV)
            ];

            weekShifts.forEach(s => {
              rows.push([
                fmtDate(s.clock_in),
                fmtTime(s.clock_in),
                fmtTime(s.clock_out),
                s.break_minutes || 0,
                (s.total_hours || 0).toFixed(2),
                s.notes
              ].map(escapeCSV));
            });

            rows.push(["", "", "", escapeCSV("Total Hours:"), escapeCSV(totalHrs.toFixed(2)), ""]);

            const csvContent = rows.map(e => e.join(",")).join("\n");
            
            const blob = new Blob([csvContent], { type:"text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `shift-invoice-${start.toISOString().split("T")[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success("Invoice downloaded!");
          }}
          className="btn-secondary text-xs flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Download
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Hours Worked", value: `${totalHrs.toFixed(1)}h`,    color:"text-blue-600 dark:text-blue-400" },
          { label: "Days Active",  value: `${days}d`,                   color:"text-indigo-600 dark:text-indigo-400" },
          { label: "Shifts Done",  value: String(weekShifts.length),    color:"text-emerald-600 dark:text-emerald-400" },
          { label: "Break Time",   value: `${totalBreak}m`,             color:"text-amber-600 dark:text-amber-400" },
        ].map(s => (
          <div key={s.label} className="bg-[var(--surface-container-low)] rounded-2xl p-4 text-center">
            <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] sm:text-xs text-[var(--on-surface-variant)] font-semibold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {weekShifts.length === 0 && (
        <p className="text-sm text-[var(--on-surface-variant)] text-center mt-4">No completed shifts this week.</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ShiftLogPage() {
  const [user,        setUser]        = useState(null);
  const [shifts,      setShifts]      = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [elapsed,     setElapsed]     = useState(0);
  const [breakNote,   setBreakNote]   = useState("");
  const [shiftNote,   setShiftNote]   = useState("");
  const router = useRouter();

  const displayName = useCallback(u => {
    if (!u) return "User";
    const { first_name, last_name, username } = u.user_metadata || {};
    if (first_name) return `${first_name}${last_name ? " " + last_name : ""}`.trim();
    return username || u.email?.split("@")[0] || "User";
  }, []);

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setUser(session.user);
      loadShifts(session.user.id);
      // Check active shift
      supabase.from("shift_logs").select("*")
        .eq("user_id", session.user.id)
        .in("status", ["active","on_break"])
        .order("clock_in", { ascending:false }).limit(1)
        .then(({ data }) => setActiveShift(data?.[0] || null));
    });
  }, []);

  // ── Ticker ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeShift?.clock_in) { setElapsed(0); return; }
    const update = () => setElapsed(Math.floor((Date.now() - new Date(activeShift.clock_in).getTime()) / 1000));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [activeShift?.clock_in]);

  async function loadShifts(uid) {
    setLoading(true);
    const { data } = await supabase.from("shift_logs")
      .select("*").eq("user_id", uid)
      .order("clock_in", { ascending: false }).limit(50);
    setShifts(data || []);
    setLoading(false);
  }

  // ── Actions ─────────────────────────────────────────────────────────────
  async function clockIn() {
    if (!user) return;
    const { data } = await supabase.from("shift_logs").insert([{
      user_id:    user.id,
      user_name:  displayName(user),
      user_email: user.email,
      clock_in:   new Date().toISOString(),
      shift_date: new Date().toISOString().split("T")[0],
      status:     "active",
      notes:      shiftNote.trim() || null,
    }]).select();
    if (data?.[0]) {
      setActiveShift(data[0]);
      toast.success("Shift started! Have a great session 🎉");
      loadShifts(user.id);
    }
  }

  async function takeBreak() {
    if (!activeShift || activeShift.status === "on_break") return;
    await supabase.from("shift_logs").update({
      status:      "on_break",
      break_start: new Date().toISOString(),
    }).eq("id", activeShift.id);
    setActiveShift(prev => ({ ...prev, status: "on_break", break_start: new Date().toISOString() }));
    toast.success("Break started. Rest up! ☕");
  }

  async function endBreak() {
    if (!activeShift || activeShift.status !== "on_break") return;
    const breakMins = Math.floor((Date.now() - new Date(activeShift.break_start).getTime()) / 60000);
    const totalBreak = (activeShift.break_minutes || 0) + breakMins;
    await supabase.from("shift_logs").update({
      status:         "active",
      break_minutes:  totalBreak,
      break_start:    null,
    }).eq("id", activeShift.id);
    setActiveShift(prev => ({ ...prev, status: "active", break_minutes: totalBreak, break_start: null }));
    toast.success(`Break ended. ${breakMins}m added to break time.`);
  }

  async function clockOut() {
    if (!activeShift) return;
    const clockOutTime = new Date();
    const totalMins    = Math.floor((clockOutTime - new Date(activeShift.clock_in)) / 60000) - (activeShift.break_minutes || 0);
    const totalHrs     = parseFloat(Math.max(0, totalMins / 60).toFixed(2));

    await supabase.from("shift_logs").update({
      clock_out:   clockOutTime.toISOString(),
      total_hours: totalHrs,
      status:      "completed",
    }).eq("id", activeShift.id);

    toast.success(`Shift complete! You worked ${totalHrs.toFixed(1)}h today.`);
    setActiveShift(null);
    loadShifts(user.id);
  }

  const fmt = s => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-5 sm:space-y-7">

        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--on-surface)] tracking-tight">Shift Log</h1>
          <p className="text-xs sm:text-sm text-[var(--on-surface-variant)] mt-0.5">Track your working hours and generate weekly reports.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-7 items-start">

          {/* ── Clock In/Out card ──────────────────────────────────── */}
          <div className="lg:col-span-1 app-card p-4 sm:p-6 relative overflow-hidden">
            {/* Decorative */}
            <div className="absolute top-0 right-0 p-3 opacity-[0.04]">
              <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
            </div>

            <div className="relative z-10">
              {/* Timer display */}
              <div className="flex items-center gap-3 mb-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeShift ? (activeShift.status === "on_break" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500") : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--on-surface-variant)] uppercase tracking-widest">
                    {!activeShift ? "Not Clocked In" : activeShift.status === "on_break" ? "On Break" : "Active Session"}
                  </p>
                  <p className="text-3xl font-black text-[var(--on-surface)] font-mono leading-none">{fmt(elapsed)}</p>
                </div>
              </div>

              {activeShift && (
                <div className="space-y-2 mb-6">
                  {[
                    { label:"Clocked In",   val: fmtTime(activeShift.clock_in) },
                    { label:"Break Time",   val: `${activeShift.break_minutes || 0} min`, accent: true },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between items-center py-2.5 border-b border-[var(--outline-variant)]/10 last:border-0">
                      <span className="text-sm text-[var(--on-surface-variant)]">{r.label}</span>
                      <span className={`text-sm font-bold ${r.accent ? "text-emerald-500" : "text-[var(--on-surface)]"}`}>{r.val}</span>
                    </div>
                  ))}
                </div>
              )}

              {!activeShift ? (
                <div className="space-y-3">
                  <textarea
                    value={shiftNote}
                    onChange={e => setShiftNote(e.target.value)}
                    placeholder="Optional shift note…"
                    rows={2}
                    className="w-full text-sm bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 rounded-xl px-3 py-2 text-[var(--on-surface)] placeholder-[var(--on-surface-variant)] outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button onClick={clockIn} className="w-full btn-primary btn-shiny flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                    Clock In
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* Break toggle */}
                  {activeShift.status === "on_break" ? (
                    <button onClick={endBreak} className="flex flex-col items-center gap-1.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all active:scale-95">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <span className="text-[10px] font-bold uppercase tracking-tighter">End Break</span>
                    </button>
                  ) : (
                    <button onClick={takeBreak} className="flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border-2 border-[var(--outline-variant)]/20 hover:border-blue-500/40 hover:bg-blue-500/5 text-[var(--on-surface-variant)] hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 group">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Take Break</span>
                    </button>
                  )}
                  {/* Clock Out */}
                  <button onClick={clockOut} className="flex flex-col items-center gap-1.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 group">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Clock Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: weekly report + history ──────────────── */}
          <div className="lg:col-span-2 space-y-5 sm:space-y-6">
            <WeeklyReport shifts={shifts} />

            {/* Shift history */}
            <div className="app-card overflow-hidden">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--outline-variant)]/10 flex items-center justify-between">
                <h3 className="font-black text-[var(--on-surface)] text-sm sm:text-base">Shift History</h3>
                <span className="text-[10px] sm:text-xs text-[var(--on-surface-variant)] font-semibold">Last 50 shifts</span>
              </div>

              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : shifts.length === 0 ? (
                <div className="py-16 text-center text-[var(--on-surface-variant)]">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                  <p className="text-sm font-semibold">No shifts recorded yet.</p>
                  <p className="text-xs mt-1">Clock in to start tracking your time.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--outline-variant)]/10">
                  {shifts.map(s => {
                    const workMins = s.total_hours ? s.total_hours * 60 : null;
                    return (
                      <div key={s.id} className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-[var(--surface-container-low)] transition-colors">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-500/10 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 text-center">
                            <div>
                              <p className="text-[9px] sm:text-[10px] font-black leading-none">{new Date(s.clock_in).toLocaleDateString([],{month:"short"})}</p>
                              <p className="text-base sm:text-lg font-black leading-none">{new Date(s.clock_in).getDate()}</p>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <p className="text-sm font-bold text-[var(--on-surface)]">{fmtDate(s.clock_in)}</p>
                              <StatusBadge status={s.status} />
                            </div>
                            <p className="text-xs text-[var(--on-surface-variant)]">
                              {fmtTime(s.clock_in)} → {s.clock_out ? fmtTime(s.clock_out) : "—"}
                              {s.break_minutes ? ` · Break: ${s.break_minutes}m` : ""}
                            </p>
                            {s.notes && <p className="text-xs text-[var(--on-surface-variant)] mt-0.5 italic truncate">"{s.notes}"</p>}
                          </div>
                        </div>

                        <div className="text-left sm:text-right flex-shrink-0 pl-13 sm:pl-0">
                          {s.total_hours != null ? (
                            <>
                              <p className="text-base sm:text-lg font-black text-[var(--on-surface)] inline sm:block">{s.total_hours.toFixed(1)}h</p>
                              <p className="text-[10px] text-[var(--on-surface-variant)] font-semibold inline sm:block ml-1 sm:ml-0">worked</p>
                            </>
                          ) : (
                            <span className="text-xs text-emerald-500 font-bold">In progress</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
