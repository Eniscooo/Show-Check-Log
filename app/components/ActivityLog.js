"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Dropdown from "./Dropdown";

const ACTION_ICONS = {
    created_show: { icon: "✨", label: "Created Show", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    deleted_show: { icon: "🗑", label: "Deleted Show", color: "text-red-500", bg: "bg-red-500/10" },
    joined_show: { icon: "👋", label: "Joined Show", color: "text-blue-500", bg: "bg-blue-500/10" },
    left_show: { icon: "🚪", label: "Left Show", color: "text-gray-500", bg: "bg-gray-500/10" },
    status_checked: { icon: "✅", label: "Checked", color: "text-green-500", bg: "bg-green-500/10" },
    status_unchecked: { icon: "🔄", label: "Unchecked", color: "text-amber-500", bg: "bg-amber-500/10" },
    notes_updated: { icon: "📝", label: "Notes Updated", color: "text-indigo-500", bg: "bg-indigo-500/10" },
    priority_changed: { icon: "🏷", label: "Priority Changed", color: "text-purple-500", bg: "bg-purple-500/10" },
    posted_announcement: { icon: "📢", label: "Announcement", color: "text-amber-500", bg: "bg-amber-500/10" },
    deleted_announcement: { icon: "🗑️", label: "Deleted Announcement", color: "text-red-500", bg: "bg-red-500/10" },
    uploaded_screenshot: { icon: "📸", label: "Screenshot", color: "text-pink-500", bg: "bg-pink-500/10" },
    default: { icon: "📋", label: "Activity", color: "text-gray-500", bg: "bg-gray-500/10" }
};

export default function ActivityLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const [filter, setFilter] = useState("all");
    const [showCount, setShowCount] = useState(15);

    useEffect(() => {
        fetchLogs();

        const channel = supabase
            .channel('activity-log-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
                setLogs(prev => [payload.new, ...prev].slice(0, 50));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchLogs() {
        try {
            const { data, error } = await supabase
                .from("activity_log")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) {
                if (error.code === '42P01') {
                    setLogs([]);
                    setLoading(false);
                    return;
                }
                console.error("Error fetching activity log:", error);
            } else {
                setLogs(data || []);
            }
        } catch (err) {
            console.error("Activity log fetch failed:", err);
        } finally {
            setLoading(false);
        }
    }

    function formatTime(dateStr) {
        const d = new Date(dateStr);
        const diff = Date.now() - d.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    const filteredLogs = filter === "all"
        ? logs
        : logs.filter(l => l.action === filter);

    const visibleLogs = filteredLogs.slice(0, showCount);

    if (loading) return null;

    return (
        <div id="activity-log" className="mt-8">
            {/* Section Header */}
            <div className="flex items-center justify-between gap-2 mb-6">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center gap-2 group min-w-0 flex-shrink"
                >
                    <div className="bg-indigo-500/10 p-1.5 sm:p-2 rounded-xl border border-indigo-500/20 flex-shrink-0 transition-transform group-hover:scale-105 group-active:scale-95">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    {/* Handled by page.js instead to unify layout, so we just show caret and badge */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold opacity-70 group-hover:opacity-100 transition-opacity">Activity</span>
                        {logs.length > 0 && (
                            <span className="text-[10px] sm:text-xs font-bold bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-500/20 flex-shrink-0">{logs.length}</span>
                        )}
                        <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--on-surface-variant)] transition-transform duration-200 flex-shrink-0 ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </button>

                {!collapsed && logs.length > 0 && (
                    <Dropdown
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { value: "all", label: "All Activity" },
                            { value: "created_show", label: "Created" },
                            { value: "joined_show", label: "Joined" },
                            { value: "status_checked", label: "Checked" },
                            { value: "notes_updated", label: "Notes" },
                            { value: "priority_changed", label: "Priority" },
                            { value: "posted_announcement", label: "Announce" }
                        ]}
                        className="flex-shrink-0 w-[120px] sm:w-[140px]"
                        triggerClassName="w-full font-bold tracking-wide bg-[var(--surface-container-highest)] hover:bg-[var(--surface-container)] dark:bg-slate-800/80 dark:hover:bg-slate-700 border border-[var(--outline-variant)]/30 rounded-[20px] px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs text-[var(--on-surface)] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] focus:ring-2 focus:ring-indigo-500/50"
                        dropdownClassName="w-[150px] right-0 left-auto"
                    />
                )}
            </div>

            {/* Activity Timeline */}
            {!collapsed && (
                <div className="bg-[var(--surface-container-lowest)] rounded-3xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.05)] border border-[var(--outline-variant)]/20 dark:border-transparent overflow-hidden py-2">
                    {logs.length === 0 ? (
                        <div className="p-10 text-center">
                            <div className="mx-auto w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4 transition-transform hover:scale-105">
                                <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <p className="text-sm font-semibold text-[var(--on-surface-variant)] opacity-90">No activity recorded yet</p>
                            <p className="text-xs text-[var(--on-surface-variant)] mt-1.5 opacity-60">Actions will appear here as users interact</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col">
                                {visibleLogs.map((log, i) => {
                                    const actionCfg = ACTION_ICONS[log.action] || ACTION_ICONS.default;
                                    return (
                                        <div key={log.id || i} className="px-5 sm:px-6 py-3.5 flex items-start gap-4 hover:bg-[var(--surface-container-low)] transition-all duration-200 group cursor-default">
                                            <div className={`mt-0.5 w-9 h-9 rounded-[14px] ${actionCfg.bg} flex items-center justify-center text-sm shrink-0 shadow-sm border border-black/5 dark:border-transparent`}>
                                                {actionCfg.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] sm:text-sm text-[var(--on-surface-variant)] leading-snug">
                                                    <span className="font-extrabold text-[var(--on-surface)] truncate capitalize">{log.user_name}</span>
                                                    {" "}
                                                    <span className="opacity-90">{log.description?.replace(log.user_name, '').trim()}</span>
                                                </p>
                                                <span className="text-[10px] font-bold text-[var(--on-surface-variant)] opacity-70 mt-1 block tracking-wide uppercase">
                                                    {formatTime(log.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {filteredLogs.length > showCount && (
                                <button
                                    onClick={() => setShowCount(prev => prev + 15)}
                                    className="w-full py-4 text-xs font-bold tracking-wide uppercase text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-colors border-t border-[var(--outline-variant)]/10 dark:border-transparent"
                                >
                                    Load More ({filteredLogs.length - showCount} remaining)
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
