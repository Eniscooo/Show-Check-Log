"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

const PRIORITY_CONFIG = {
    urgent: {
        label: "Urgent",
        color: "text-red-500",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        ring: "ring-red-500/40",
        glow: "shadow-[0_0_15px_rgba(239,68,68,0.25)]",
        badge: "bg-red-500/15 text-red-500 border-red-500/25",
        icon: "🔴"
    },
    high: {
        label: "High",
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        border: "border-orange-500/30",
        ring: "ring-orange-400/40",
        glow: "shadow-[0_0_12px_rgba(251,146,60,0.2)]",
        badge: "bg-orange-500/15 text-orange-500 border-orange-500/25",
        icon: "🟠"
    },
    normal: {
        label: "Normal",
        color: "text-indigo-400",
        bg: "bg-indigo-500/10",
        border: "border-indigo-500/20",
        ring: "ring-indigo-400/30",
        glow: "",
        badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
        icon: "🔵"
    },
    low: {
        label: "Low",
        color: "text-gray-400",
        bg: "bg-gray-500/5",
        border: "border-gray-500/15",
        ring: "ring-gray-400/20",
        glow: "",
        badge: "bg-gray-500/10 text-gray-400 border-gray-500/20",
        icon: "⚪"
    }
};

export default function AnnouncementBoard() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    // Form state
    const [form, setForm] = useState({ title: "", content: "", priority: "normal" });

    useEffect(() => {
        fetchAnnouncements();
        fetchUser();

        const channel = supabase
            .channel('announcements-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
                fetchAnnouncements();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchUser() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUser(user);
            let adminFlag = user.user_metadata?.is_admin === true;
            try {
                const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
                if (profile?.is_admin) adminFlag = true;
            } catch (e) { }
            setIsAdmin(adminFlag);
        }
    }

    async function fetchAnnouncements() {
        try {
            const { data, error } = await supabase
                .from("announcements")
                .select("*")
                .order("pinned", { ascending: false })
                .order("created_at", { ascending: false });

            if (error) {
                // Table might not exist yet
                if (error.code === '42P01') {
                    setAnnouncements([]);
                    setLoading(false);
                    return;
                }
                console.error("Error fetching announcements:", error);
            } else {
                setAnnouncements(data || []);
            }
        } catch (err) {
            console.error("Announcements fetch failed:", err);
        } finally {
            setLoading(false);
        }
    }

    function getUserDisplayName() {
        if (!currentUser) return "User";
        const first = currentUser.user_metadata?.first_name || "";
        const last = currentUser.user_metadata?.last_name || "";
        const username = currentUser.user_metadata?.username || "";
        return (first && last) ? `${first} ${last}` : username || currentUser.email?.split('@')[0] || "User";
    }

    async function handleCreate() {
        if (!form.title.trim() || !form.content.trim()) {
            toast.error("Title and content are required");
            return;
        }

        const { error } = await supabase.from("announcements").insert([{
            user_id: currentUser.id,
            user_name: getUserDisplayName(),
            title: form.title.trim(),
            content: form.content.trim(),
            priority: form.priority
        }]);

        if (error) {
            toast.error("Failed to post: " + error.message);
            return;
        }

        toast.success("Announcement posted!");
        setForm({ title: "", content: "", priority: "normal" });
        setIsCreateOpen(false);
        fetchAnnouncements();

        // Log activity
        try {
            await supabase.from("activity_log").insert([{
                user_id: currentUser.id,
                user_name: getUserDisplayName(),
                action: "posted_announcement",
                description: `${getUserDisplayName()} posted announcement: "${form.title.trim()}"`
            }]);
        } catch (e) { }
    }

    async function handleUpdate() {
        if (!form.title.trim() || !form.content.trim()) {
            toast.error("Title and content are required");
            return;
        }

        const { error } = await supabase.from("announcements").update({
            title: form.title.trim(),
            content: form.content.trim(),
            priority: form.priority,
            updated_at: new Date().toISOString()
        }).eq("id", editingId);

        if (error) {
            toast.error("Failed to update: " + error.message);
            return;
        }

        toast.success("Announcement updated!");
        setEditingId(null);
        setForm({ title: "", content: "", priority: "normal" });
        fetchAnnouncements();
    }

    async function handleDelete(id) {
        const target = announcements.find(a => a.id === id);
        const { error } = await supabase.from("announcements").delete().eq("id", id);
        if (error) {
            toast.error("Failed to delete: " + error.message);
            return;
        }
        toast.success("Announcement deleted");
        if (target) {
            try {
                await supabase.from("activity_log").insert([{
                    show_id: null,
                    user_id: currentUser.id,
                    user_name: getUserDisplayName(),
                    action: "deleted_announcement",
                    description: `${getUserDisplayName()} deleted announcement: "${target.title}"`
                }]);
            } catch (e) { }
        }
        fetchAnnouncements();
    }

    async function handleTogglePin(id, currentPinned) {
        const { error } = await supabase.from("announcements").update({ pinned: !currentPinned }).eq("id", id);
        if (error) {
            toast.error("Failed to update pin: " + error.message);
            return;
        }
        fetchAnnouncements();
    }

    function startEdit(announcement) {
        setEditingId(announcement.id);
        setForm({ title: announcement.title, content: announcement.content, priority: announcement.priority });
        setIsCreateOpen(true);
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
        return d.toLocaleDateString();
    }

    const visibleAnnouncements = showAll ? announcements : announcements.slice(0, 3);

    if (loading) return null;

    return (
        <div id="announcements" className="mb-8">
            {/* Section Header */}
            <div className="flex items-center justify-between gap-2 mb-6">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center gap-2 group min-w-0 flex-shrink"
                >
                    <div className="bg-amber-500/10 p-1.5 sm:p-2 rounded-xl border border-amber-500/20 flex-shrink-0 transition-transform group-hover:scale-105 group-active:scale-95">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    </div>
                    {/* Only show badge and collapse caret on desktop side, label is handled by page.js */}
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold opacity-70 group-hover:opacity-100 transition-opacity">Announcements</span>
                        {announcements.length > 0 && (
                            <span className="text-[10px] sm:text-xs font-bold bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-500/20 flex-shrink-0">{announcements.length}</span>
                        )}
                        <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--on-surface-variant)] transition-transform duration-200 flex-shrink-0 ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </button>

                {!collapsed && (
                    <button
                        onClick={() => { setIsCreateOpen(true); setEditingId(null); setForm({ title: "", content: "", priority: "normal" }); }}
                        className="btn-shiny inline-flex items-center gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-bold hover:bg-indigo-500 shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all active:scale-95 flex-shrink-0"
                    >
                        <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        <span className="hidden sm:inline tracking-wide">Post Announcement</span>
                    </button>
                )}
            </div>

            {/* Announcements List */}
            {!collapsed && (
                <div className="space-y-3 stagger-children">
                    {announcements.length === 0 ? (
                        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 p-8 text-center">
                            <div className="mx-auto w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-3">
                                <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                            </div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No announcements yet</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Post an update for the team to see</p>
                        </div>
                    ) : visibleAnnouncements.map(a => {
                        const cfg = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.normal;
                        return (
                            <div key={a.id} className={`bg-[var(--surface-container-lowest)] rounded-2xl border ${cfg.border} ${a.priority === 'urgent' ? 'animate-pulseGlow' : ''} shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-4 sm:p-5 transition-all duration-200 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 group relative`}>
                                <div className="flex flex-col items-start gap-3">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        {a.pinned && <span className="text-[10px] font-extrabold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 flex items-center gap-1 tracking-widest uppercase">📌 Pinned</span>}
                                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border tracking-widest ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <h4 className="text-lg sm:text-xl font-black text-[var(--on-surface)] leading-tight">{a.title}</h4>
                                        <p className="text-[13px] sm:text-sm text-[var(--on-surface-variant)] leading-relaxed whitespace-pre-wrap">{a.content}</p>
                                    </div>
                                    <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-1 pt-3 border-t border-[var(--outline-variant)]/10 dark:border-transparent">
                                        <div className="flex items-center gap-3 text-xs font-semibold text-[var(--on-surface-variant)] opacity-70">
                                            <span className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-[var(--surface-container-highest)] flex items-center justify-center text-[10px] font-bold text-[var(--on-surface)]">{a.user_name?.charAt(0).toUpperCase()}</span>
                                                <span className="capitalize">{a.user_name}</span>
                                            </span>
                                            <span>·</span>
                                            <span>{formatTime(a.created_at)}</span>
                                            {a.updated_at !== a.created_at && <span className="italic">(edited)</span>}
                                        </div>
                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                            {isAdmin && (
                                                <button onClick={() => handleTogglePin(a.id, a.pinned)} className="p-1.5 text-gray-400 hover:text-amber-500 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors" title={a.pinned ? "Unpin" : "Pin"}>
                                                    <svg className="w-4 h-4" fill={a.pinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="17" x2="12" y2="22" />
                                                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                                    </svg>
                                                </button>
                                            )}
                                            {(currentUser?.id === a.user_id) && (
                                                <button onClick={() => startEdit(a)} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors" title="Edit">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                            )}
                                            {(currentUser?.id === a.user_id || isAdmin) && (
                                                <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {announcements.length > 3 && (
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className="w-full py-2.5 text-sm font-bold text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/5 rounded-xl transition-colors"
                        >
                            {showAll ? `Show Less ↑` : `View All ${announcements.length} Announcements ↓`}
                        </button>
                    )}
                </div>
            )}

            {/* Create/Edit Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg ring-1 ring-black/5 dark:ring-transparent animate-springUp max-h-[90vh] flex flex-col">
                        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                                {editingId ? "Edit Announcement" : "New Announcement"}
                            </h3>
                            <button onClick={() => { setIsCreateOpen(false); setEditingId(null); setForm({ title: "", content: "", priority: "normal" }); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Title *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="Announcement title…"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Content *</label>
                                <textarea
                                    value={form.content}
                                    onChange={e => setForm({ ...form, content: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                                    rows={4}
                                    placeholder="Write your announcement…"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Priority</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setForm({ ...form, priority: key })}
                                            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${form.priority === key
                                                ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ${cfg.ring}`
                                                : 'bg-gray-50 dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            {cfg.icon} {cfg.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3 mt-auto">
                            <button onClick={() => { setIsCreateOpen(false); setEditingId(null); setForm({ title: "", content: "", priority: "normal" }); }} className="px-4 sm:px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
                            <button onClick={editingId ? handleUpdate : handleCreate} className="btn-shiny px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/25 transition-all">
                                {editingId ? "Update" : "Post Announcement"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
