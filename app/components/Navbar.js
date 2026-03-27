"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isWebsitesOpen, setIsWebsitesOpen] = useState(false);
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [recentUsers, setRecentUsers] = useState([]);
    const [isRecentUsersOpen, setIsRecentUsersOpen] = useState(false);
    const [theme, setTheme] = useState("dark");
    const dropdownRef = useRef(null);

    useEffect(() => {
        async function fetchUser() {
            const { data } = await supabase.auth.getUser();
            if (data?.user) {
                setUser(data.user);
            }
        }
        fetchUser();

        async function fetchRecentUsers() {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, last_seen')
                .order('last_seen', { ascending: false, nullsFirst: false })
                .gt('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // only last 24h
                .limit(20);

            if (error) {
                console.error('[LastSeen] fetch error:', error.message);
                return;
            }

            if (data) {
                const now = new Date();
                const mapped = data
                    .filter(d => d.last_seen)
                    .map(d => {
                        const lastSeen = new Date(d.last_seen);
                        const isOnline = (now - lastSeen) < 3.5 * 60 * 1000;
                        const name = d.email
                            ? d.email.split('@')[0]
                            : `User ${d.id.slice(0, 6)}`;
                        return { id: d.id, name, time: d.last_seen, isOnline };
                    });
                setRecentUsers(mapped);
            }
        }

        fetchRecentUsers();

        // Real-time subscription for immediate updates (requires Realtime to be enabled on Supabase)
        const channel = supabase
            .channel('public:profiles')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles'
            }, () => {
                fetchRecentUsers();
            })
            .subscribe();

        // Also poll every 15s to update UI naturally
        const pollInterval = setInterval(fetchRecentUsers, 15000);

        // Theme initialization — default to dark
        const storedTheme = localStorage.getItem("theme");
        if (storedTheme) {
            setTheme(storedTheme);
            document.documentElement.classList.toggle("dark", storedTheme === "dark");
        } else {
            // Default dark mode for new users
            setTheme("dark");
            localStorage.setItem("theme", "dark");
            document.documentElement.classList.add("dark");
        }

        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsWebsitesOpen(false);
            }
            if (!event.target.closest('.recent-users-container')) {
                setIsRecentUsersOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);

        // --- Presence Pinging (updates last_seen) ---
        let pingInterval;
        async function pingPresence() {
            const { data: authData } = await supabase.auth.getUser();
            const user = authData?.user;
            if (!user) return;

            const now = new Date().toISOString();

            // Try UPDATE first
            const { data: updateData, error: updateError, count } = await supabase
                .from('profiles')
                .update({ last_seen: now })
                .eq('id', user.id)
                .select('id');

            if (updateError) {
                console.error('[LastSeen] UPDATE failed:', updateError.message, updateError.code);
                return;
            }

            // If UPDATE matched 0 rows, the profile row doesn't exist yet → upsert it
            if (!updateData || updateData.length === 0) {
                console.warn('[LastSeen] No profile row found for user', user.id, '— upserting now');
                // Only upsert the guaranteed columns: id and last_seen
                const { error: upsertError } = await supabase.from('profiles').upsert({
                    id: user.id,
                    last_seen: now,
                }, { onConflict: 'id' });

                if (upsertError) {
                    console.error('[LastSeen] UPSERT also failed:', upsertError.message);
                } else {
                    console.log('[LastSeen] Profile row created/updated successfully');
                    // Enrich future fetchRecentUsers calls with the display name
                    const displayName = user.user_metadata?.first_name
                        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
                        : user.user_metadata?.username || user.email?.split('@')[0] || 'User';
                    setRecentUsers(prev => prev.map(u =>
                        u.id === user.id ? { ...u, name: displayName } : u
                    ));
                }
            } else {
                console.log('[LastSeen] Ping OK at', now);
                // Update the name in local state for this user
                const displayName = user.user_metadata?.first_name
                    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
                    : user.user_metadata?.username || user.email?.split('@')[0] || 'User';
                setRecentUsers(prev => prev.map(u =>
                    u.id === user.id ? { ...u, name: displayName } : u
                ));
            }
        }

        pingPresence(); // Ping immediately on load
        pingInterval = setInterval(pingPresence, 90 * 1000); // Ping every 90 seconds

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
            clearInterval(pingInterval);
        };
    }, []);

    function toggleTheme() {
        const newTheme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);
        document.documentElement.classList.toggle("dark", newTheme === "dark");
    }

    async function handleSignOut() {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    }

    function getTimeAgo(time) {
        if (!time) return 'Unknown';
        const diff = Date.now() - new Date(time).getTime();
        if (diff < 0) return 'Just now'; // clock skew guard
        const secs = Math.floor(diff / 1000);
        if (secs < 60) return 'Just now';
        const mins = Math.floor(secs / 60);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        const remainMins = mins % 60;
        if (hrs < 24) return remainMins > 0 ? `${hrs}h ${remainMins}m ago` : `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    }

    const onlineCount = recentUsers.filter(u => u.isOnline).length;

    const popularWebsites = [
        { name: "Blue Note", url: "https://www.bluenotejazz.com/nyc/" },
        { name: "ATG", url: "https://us.atgtickets.com/" },
        { name: "Telecharge", url: "https://telecharge.com/" },
        { name: "Broadway Direct", url: "https://broadwaydirect.com/" },
        { name: "Ticketmaster", url: "https://ticketmaster.com/" }
    ];

    return (
        <header className="bg-slate-900 shadow-lg border-b border-white/10 relative z-50">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 opacity-50"></div>
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between relative z-10">
                {/* Logo */}
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
                        <div className="bg-indigo-500/10 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-indigo-500/20 backdrop-blur-sm group-hover:bg-indigo-500/20 transition-all flex-shrink-0">
                            <svg className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-base sm:text-xl font-bold text-white tracking-tight truncate">Show Check Log</h1>
                            <p className="text-[10px] sm:text-xs text-indigo-200/60 font-medium hidden xs:block">Monitoring Dashboard</p>
                        </div>
                    </Link>
                </div>

                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-4">
                    <div className="relative recent-users-container">
                        <button onClick={() => setIsRecentUsersOpen(!isRecentUsersOpen)} className="text-gray-300 text-xs flex flex-col items-end mr-2 hover:bg-white/5 p-1 px-2 rounded-lg transition-colors cursor-pointer text-left">
                            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                {onlineCount > 0 ? `${onlineCount} Online` : 'System Active'}
                            </span>
                            <span className="text-gray-400 capitalize max-w-[150px] truncate">
                                {recentUsers.length > 0 ? recentUsers.slice(0, 3).map(u => u.name).join(', ') : 'No recent activity'}
                            </span>
                        </button>

                        {isRecentUsersOpen && recentUsers.length > 0 && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.4)] overflow-hidden z-50">
                                <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Recently Active</h4>
                                    {onlineCount > 0 && <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{onlineCount} online</span>}
                                </div>
                                <div className="max-h-64 overflow-y-auto w-full">
                                    {recentUsers.map((u, idx) => (
                                        <div key={idx} className="px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors flex justify-between items-center group">
                                            <div className="flex items-center gap-2.5">
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-gray-600'}`}></span>
                                                <span className="text-sm font-medium text-gray-200 capitalize truncate max-w-[120px]">{u.name}</span>
                                            </div>
                                            <span className={`text-[10px] font-medium ${u.isOnline ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                {u.isOnline ? 'Online' : getTimeAgo(u.time)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-1"></div>

                    <div className="relative" ref={dropdownRef}>
                        <button onClick={() => setIsWebsitesOpen(!isWebsitesOpen)} className="text-gray-300 hover:text-white transition-colors text-sm font-semibold flex items-center gap-1.5 bg-white/5 py-1.5 px-3 rounded-full border border-white/5 hover:border-white/20">
                            Popular Sites
                            <svg className={`w-3.5 h-3.5 transition-transform ${isWebsitesOpen ? 'rotate-180 text-indigo-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {isWebsitesOpen && (
                            <div className="absolute top-full mt-3 right-0 w-56 bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.4)] border border-white/10 p-2 z-50">
                                <div className="px-3 py-2 mb-1 border-b border-white/10">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Quick Links</span>
                                </div>
                                {popularWebsites.map(site => (
                                    <a key={site.name} href={site.url} target="_blank" rel="noopener noreferrer" className="group/item flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                        <span>{site.name}</span>
                                        <svg className="w-4 h-4 text-gray-500 group-hover/item:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    <button onClick={toggleTheme} className="text-gray-300 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5" title="Toggle Theme">
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                        )}
                    </button>

                    <div className="bg-white/5 rounded-full p-1 border border-white/10 hover:bg-white/10 transition-colors">
                        <NotificationBell />
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="btn-shiny bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-4 py-2 rounded-lg border border-red-500/20 text-xs font-bold transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                    </button>
                </div>

                {/* Mobile Actions */}
                <div className="flex md:hidden items-center gap-2 sm:gap-3">
                    <button onClick={toggleTheme} className="text-gray-400 hover:text-white p-2">
                        {theme === 'dark' ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
                    </button>
                    <div className="bg-white/5 rounded-full p-1 border border-white/10">
                        <NotificationBell />
                    </div>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="text-gray-400 hover:text-white p-2 active:scale-95 transition-transform"
                        aria-label="Toggle menu"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            {isMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <>
                    <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="md:hidden absolute top-16 sm:top-20 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 shadow-2xl z-40">
                        <nav className="p-4 space-y-2 max-w-lg mx-auto text-white">

                            {/* Last Seen - Mobile */}
                            <div className="rounded-xl overflow-hidden border border-white/5">
                                <button
                                    onClick={() => setIsRecentUsersOpen(!isRecentUsersOpen)}
                                    className="w-full flex items-center gap-3 p-4 text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    <div className="bg-emerald-500/10 p-2 rounded-lg">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                        </span>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <span className="font-bold text-base">Last Seen</span>
                                        <p className="text-xs text-gray-400">{onlineCount > 0 ? `${onlineCount} online now` : 'Who was active recently'}</p>
                                    </div>
                                    <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isRecentUsersOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {isRecentUsersOpen && (
                                    <div className="bg-slate-800/40 border-t border-white/5 p-2 space-y-1">
                                        {recentUsers.length === 0 ? (
                                            <p className="text-xs text-gray-500 text-center py-3">No recent activity</p>
                                        ) : recentUsers.map((u, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${u.isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-gray-600'}`}></span>
                                                    <span className="text-sm font-medium text-gray-200 capitalize">{u.name}</span>
                                                </div>
                                                <span className={`text-[10px] font-medium ${u.isOnline ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                    {u.isOnline ? 'Online' : getTimeAgo(u.time)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Popular Sites Accordion */}
                            <MobileSitesDropdown sites={popularWebsites} />

                            {/* FAQ Link */}
                            <Link href="/faq" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-4 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                                <div className="bg-white/5 p-2 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <span className="font-bold text-base">FAQ</span>
                                    <p className="text-xs text-gray-400">Frequently asked questions</p>
                                </div>
                            </Link>

                            {/* Sign Out */}
                            <button
                                onClick={handleSignOut}
                                className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all active:scale-95 border border-red-500/20 mt-4"
                            >
                                <div className="bg-red-500/20 p-2 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </div>
                                <div className="btn-shiny flex-1 text-left">
                                    <span className="btn-shiny font-bold text-base">Sign Out</span>
                                    <p className="text-xs text-red-300/60">Log out of your account</p>
                                </div>
                            </button>
                        </nav>
                    </div>
                </>
            )}
        </header>
    );
}

// ── Mobile sites accordion sub-component (uses useState, NOT React.useState) ──
function MobileSitesDropdown({ sites }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-xl overflow-hidden border border-white/5">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 p-4 text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            >
                <div className="bg-white/5 p-2 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                </div>
                <div className="flex-1 text-left">
                    <span className="font-bold text-base">Popular Sites</span>
                    <p className="text-xs text-gray-400">Quick links to streaming platforms</p>
                </div>
                <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {open && (
                <div className="bg-slate-800/40 border-t border-white/5 p-2 grid grid-cols-2 gap-1">
                    {sites.map(site => (
                        <a
                            key={site.name}
                            href={site.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            {site.name}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
