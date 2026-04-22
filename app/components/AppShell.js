"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import NotificationBell from "./NotificationBell";

// ── SVG Icon set ───────────────────────────────────────────────────────────────
const Icon = {
  dashboard: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  shows: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  messenger: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  shift: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  guide: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  add: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  menu: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  menuClose: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  sun: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  moon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
  clock: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" /></svg>,
  logout: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  search: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  help: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: "dashboard", mobileLabel: "Home" },
  { href: "/shows", label: "Check Log", icon: "shows", mobileLabel: "Shows" },
  { href: "/messenger", label: "Messenger", icon: "messenger", mobileLabel: "Chat" },
  { href: "/shift-log", label: "Shift Log", icon: "shift", mobileLabel: "Shift" },
  { href: "/guide", label: "Guide", icon: "guide", mobileLabel: "Guide" },
];

function getDisplayName(user) {
  if (!user) return "User";
  const { first_name, last_name, username } = user.user_metadata || {};
  if (first_name) {
    const fn = first_name.charAt(0).toUpperCase() + first_name.slice(1).toLowerCase();
    const ln = last_name ? " " + last_name.charAt(0).toUpperCase() + last_name.slice(1).toLowerCase() : "";
    return `${fn}${ln}`;
  }
  return username || user.email?.split("@")[0] || "User";
}

function getPosition(user) {
  if (!user) return "Operational Hub";
  const pos = user.user_metadata?.position;
  if (!pos) return "Operational Hub";
  return pos.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getInitials(name = "") {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
}

function Avatar({ user, name, avatarUrl, className = "w-9 h-9 text-sm" }) {
  const src = avatarUrl || user?.user_metadata?.avatar_url || null;
  if (src) {
    return (
      <img
        src={src}
        alt="Avatar"
        className={`${className} rounded-full object-cover flex-shrink-0 shadow-sm`}
        style={{ outline: "none" }}
      />
    );
  }
  const palettes = ["bg-blue-600", "bg-purple-600", "bg-emerald-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600"];
  const col = palettes[(name?.charCodeAt(0) || 0) % palettes.length];
  return (
    <div className={`${className} ${col} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm`}>
      {getInitials(name)}
    </div>
  );
}

function useShiftTimer(clockIn) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!clockIn) { setElapsed(0); return; }
    const update = () => setElapsed(Math.floor((Date.now() - new Date(clockIn).getTime()) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [clockIn]);
  const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("app_sidebar_collapsed") === "true";
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [clockLoading, setClockLoading] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  const displayName = getDisplayName(user);
  const position = getPosition(user);
  const timer = useShiftTimer(activeShift?.clock_in);
  const fileInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
        fetchActiveShift(data.user.id);
        loadAvatarFromProfiles(data.user.id);
      }
    });

    let pingInterval;
    async function pingPresence() {
      const { data: authData } = await supabase.auth.getUser();
      const authedUser = authData?.user;
      if (!authedUser) return;
      const now = new Date().toISOString();
      const { data: updateData } = await supabase
        .from("profiles")
        .update({ last_seen: now })
        .eq("id", authedUser.id)
        .select("id");
      if (!updateData || updateData.length === 0) {
        await supabase
          .from("profiles")
          .upsert({ id: authedUser.id, last_seen: now }, { onConflict: "id" });
      }
    }
    pingPresence();
    pingInterval = setInterval(pingPresence, 90 * 1000);

    const stored = localStorage.getItem("theme") || "dark";
    setTheme(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");

    // Collapse is now initialized in useState.

    return () => clearInterval(pingInterval);
  }, []);

  async function loadAvatarFromProfiles(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .single();
    if (data?.avatar_url) setAvatarUrl(data.avatar_url);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name.startsWith("sb-") || name.startsWith("supabase-")) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`;
      }
    });
    router.push("/login");
  }

  async function fetchActiveShift(userId) {
    const { data } = await supabase
      .from("shift_logs")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "on_break"])
      .order("clock_in", { ascending: false })
      .limit(1);
    setActiveShift(data?.[0] || null);
  }

  async function handleClockIn() {
    if (!user) return;
    setClockLoading(true);
    const { data } = await supabase.from("shift_logs").insert([{
      user_id: user.id,
      user_name: displayName,
      user_email: user.email,
      clock_in: new Date().toISOString(),
      shift_date: new Date().toISOString().split("T")[0],
      status: "active",
    }]).select();
    if (data?.[0]) setActiveShift(data[0]);
    setClockLoading(false);
  }

  async function handleClockOut() {
    if (!activeShift) return;
    setClockLoading(true);
    const clockOut = new Date();
    const clockIn = new Date(activeShift.clock_in);
    const totalMins = Math.floor((clockOut - clockIn) / 60000) - (activeShift.break_minutes || 0);
    const totalHrs = parseFloat((totalMins / 60).toFixed(2));
    await supabase.from("shift_logs").update({
      clock_out: clockOut.toISOString(),
      total_hours: totalHrs,
      status: "completed",
    }).eq("id", activeShift.id);
    setActiveShift(null);
    setClockLoading(false);
    router.push("/shift-log");
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const capturedUser = user;
    if (!capturedUser) { toast.error("Not logged in"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const resizedBase64 = canvas.toDataURL("image/jpeg", 0.8);
        const { error } = await supabase
          .from("profiles")
          .upsert(
            { id: capturedUser.id, avatar_url: resizedBase64 },
            { onConflict: "id" }
          );
        if (error) {
          toast.error("Failed to upload photo");
        } else {
          setAvatarUrl(resizedBase64);
          toast.success("Profile photo updated!");
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  }

  const sidebarClass = `hidden md:flex flex-col h-screen sticky top-0 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] z-40 overflow-hidden transition-all duration-300 ${collapsed ? "w-[72px]" : "w-[272px]"}`;

  const [isMessenger, setIsMessenger] = useState(false);
  useEffect(() => {
    setIsMessenger(window.location.pathname.startsWith("/messenger"));
  }, [pathname]);

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--background)] text-[var(--on-surface)]">

      {/* ── Desktop Sidebar ──────────────────────────────────────────────── */}
      <aside className={sidebarClass} id="app-sidebar">
        <div className="flex flex-col h-full py-5 px-3">

          {/* Brand */}
          <div className={`flex items-center gap-3 mb-8 px-1 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-10 h-10 min-w-[40px] rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h2 className="font-bold text-[var(--on-surface)] text-sm leading-tight whitespace-nowrap truncate">
                  {user ? displayName : "Show Management"}
                </h2>
                <p className="text-[10px] text-[var(--on-surface-variant)] uppercase tracking-widest truncate">{position}</p>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-0.5">
            {NAV_LINKS.map(link => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={collapsed ? link.label : undefined}
                  className={`nav-link ${isActive ? "active" : ""} ${collapsed ? "justify-center px-2" : ""}`}
                >
                  <span className="flex-shrink-0">{Icon[link.icon]}</span>
                  {!collapsed && <span className="nav-label whitespace-nowrap">{link.label}</span>}
                </Link>
              );
            })}
          </nav>

          {activeShift && !collapsed && (
            <div className="mx-1 mb-3 p-3 bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">Active Shift</p>
              <p className="text-xl font-black text-[var(--on-surface)] font-mono">{timer}</p>
            </div>
          )}

        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">


        <header className="sticky top-0 z-50 bg-[var(--topbar-bg)] backdrop-blur-md border-b border-[var(--sidebar-border)] shadow-sm flex-shrink-0 pt-14 sm:pt-0">
          <div className="flex items-center justify-between px-4 sm:px-6 h-16">

            {/* Left: hamburger + title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCollapsed(v => {
                  const newVal = !v;
                  localStorage.setItem("app_sidebar_collapsed", String(newVal));
                  return newVal;
                })}
                className="hidden md:flex p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] rounded-lg transition-colors active:scale-95"
                title="Toggle sidebar"
              >
                {collapsed ? Icon.menuClose : Icon.menu}
              </button>

              <button
                onClick={() => setMobileOpen(v => !v)}
                className="md:hidden p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors"
              >
                {mobileOpen ? Icon.menuClose : Icon.menu}
              </button>
              <h1 className="text-lg font-black text-[var(--on-surface)] tracking-tight hidden sm:block">
                {NAV_LINKS.find(l => l.href === pathname || (l.href !== "/" && pathname.startsWith(l.href)))?.label || "Dashboard"}
              </h1>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1 sm:gap-2 bg-[var(--surface-container-low)] dark:bg-[var(--surface-container)] px-1.5 py-1.5 rounded-full shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-[var(--outline-variant)]/20 dark:border-transparent transition-all">

              <button
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 text-[var(--on-surface-variant)] hover:bg-white dark:hover:bg-slate-700 hover:text-[var(--on-surface)] hover:shadow-sm rounded-full transition-all active:scale-95"
              >
                {theme === "dark" ? Icon.sun : Icon.moon}
              </button>

              <div className="p-1.5 sm:p-2 text-[var(--on-surface-variant)] hover:bg-white dark:hover:bg-slate-700 hover:text-[var(--on-surface)] hover:shadow-sm rounded-full transition-all active:scale-95 cursor-pointer">
                <NotificationBell />
              </div>

              <div className="relative group ml-1">
                <button className="flex items-center gap-2 p-0.5 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all active:scale-95">
                  <Avatar user={user} name={displayName} avatarUrl={avatarUrl} className="w-7 h-7 sm:w-8 sm:h-8 text-xs shadow-sm ring-2 ring-transparent group-hover:ring-[var(--outline-variant)]/20 dark:group-hover:ring-white/5" />
                </button>

                <div className="absolute right-0 top-[calc(100%+8px)] w-64 bg-[var(--surface-container-lowest)] dark:bg-[var(--surface-container-low)] rounded-[20px] shadow-[0_12px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-2 transform origin-top-right group-hover:scale-100 scale-95 border border-[var(--outline-variant)]/10 dark:border-transparent">
                  <div className="px-5 py-3 mb-1">
                    <p className="text-[15px] font-extrabold text-[var(--on-surface)] truncate">{displayName}</p>
                    <p className="text-sm font-medium text-[var(--on-surface-variant)] truncate mt-0.5 opacity-70">{user?.email}</p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl transition-all"
                      >
                        {avatarUrl ? "Change Photo" : "Add Photo"}
                      </button>
                      {avatarUrl && (
                        <button
                          onClick={async () => {
                            await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
                            setAvatarUrl(null);
                          }}
                          className="flex-1 py-1.5 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl transition-all"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </div>

                  <div className="px-2 space-y-0.5 pb-2">
                    <Link href="/shift-log" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] rounded-xl transition-all">
                      {Icon.shift}<span>My Shifts</span>
                    </Link>
                    <Link href="/guide" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] rounded-xl transition-all">
                      {Icon.help}<span>Help &amp; Guide</span>
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all mt-1"
                    >
                      {Icon.logout}<span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </header>

        {/* ── Mobile drawer ─────────────────────────────────────────────── */}
        {mobileOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="md:hidden fixed top-0 left-0 h-full w-[280px] bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] z-50 flex flex-col py-6 px-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-[var(--on-surface)] text-sm">{user ? displayName : "Show Management"}</h2>
                  <p className="text-[10px] text-[var(--on-surface-variant)] uppercase tracking-widest truncate">{position}</p>
                </div>
              </div>

              <nav className="flex-1 space-y-0.5">
                {NAV_LINKS.map(link => {
                  const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`nav-link ${isActive ? "active" : ""}`}
                    >
                      {Icon[link.icon]}<span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {activeShift && (
                <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">Active Shift</p>
                  <p className="text-xl font-black text-[var(--on-surface)] font-mono">{timer}</p>
                </div>
              )}
            </div>
          </>
        )}


        <main className={`flex-1 min-w-0 flex flex-col ${isMessenger
          ? "overflow-hidden min-h-0"
          : "overflow-auto pb-24 md:pb-8"
          }`}>
          {children}
        </main>

        {/* Mobile bottom nav — hidden on messenger to avoid overlapping chat input */}
        {!isMessenger && (
          <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[var(--topbar-bg)] backdrop-blur-md border-t border-[var(--sidebar-border)] z-30 flex items-end justify-around px-2 py-2">
            {[NAV_LINKS[0], NAV_LINKS[1], null, NAV_LINKS[2], NAV_LINKS[3]].map((link, i) => {
              if (!link) {
                return (
                  <Link key="fab" href="/add" className="flex flex-col items-center -mt-6">
                    <div className="w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/40 active:scale-95 transition-all">
                      {Icon.add}
                    </div>
                  </Link>
                );
              }
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors ${isActive ? "text-blue-600 dark:text-blue-400" : "text-[var(--on-surface-variant)]"}`}
                >
                  {Icon[link.icon]}
                  <span className="text-[9px] font-bold uppercase tracking-wide">{link.mobileLabel}</span>
                </Link>
              );
            })}
          </nav>
        )}

      </div>
    </div>
  );
}