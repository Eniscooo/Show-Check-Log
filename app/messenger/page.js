"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import AppShell from "../components/AppShell";
import toast from "react-hot-toast";
import { Trash, Search, UserPlus, Menu, ChevronLeft, Paperclip, SendHorizonal, X } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTimeFriendly(iso) {
    if (!iso) return "";
    const dt = new Date(iso);
    const diff = Date.now() - dt.getTime();
    if (diff < 86400000 && dt.getDate() === new Date().getDate())
        return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 172800000) return "Yesterday";
    return dt.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDate(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getDisplayName(user) {
    if (!user) return "User";
    const { first_name, last_name, username } = user.user_metadata || {};
    if (first_name) return `${first_name}${last_name ? " " + last_name : ""}`.trim();
    return username || user.email?.split("@")[0] || "User";
}

function getInitials(name = "") {
    return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
}

function getDMDisplayName(groupName, myDisplayName) {
    if (!groupName?.startsWith("DM:")) return groupName;
    let inner = groupName.replace(/^DM:\s*/, "");
    const parts = inner.split(" & ").map(s => s.trim());
    const other = parts.find(p => p.toLowerCase() !== myDisplayName.toLowerCase()) || parts[0];
    return other || inner;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
    "#6366F1", "#10B981", "#F59E0B", "#EF4444",
    "#8B5CF6", "#06B6D4", "#EC4899", "#14B8A6",
];

function Avatar({ name = "", size = "sm", online }) {
    const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
    const sz = size === "lg" ? 50 : size === "md" ? 36 : 30;
    return (
        <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
                width: sz, height: sz, borderRadius: "50%",
                background: AVATAR_COLORS[idx],
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700,
                fontSize: size === "lg" ? 18 : size === "md" ? 13 : 11,
                userSelect: "none",
                boxShadow: "0 1px 6px rgba(0,0,0,0.15)",
                letterSpacing: "0.02em",
            }}>
                {getInitials(name)}
            </div>
            {online !== undefined && (
                <span style={{
                    position: "absolute", bottom: 0, right: 0,
                    width: size === "lg" ? 12 : 9, height: size === "lg" ? 12 : 9,
                    borderRadius: "50%",
                    background: online ? "#22C55E" : "#64748B",
                    border: "2px solid var(--color-background-primary)",
                    boxShadow: online ? "0 0 6px rgba(34,197,94,0.4)" : "none",
                }} />
            )}
        </div>
    );
}

// ── Emoji Picker ──────────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = {
    "😊 Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓"],
    "👍 Gestures": ["👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "💪", "🦾", "🙏", "🤲", "👐", "🫶", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "💯", "✅", "❌", "⚡", "🔥", "🎉", "🎊", "🎯", "💡", "🚀", "⭐"],
    "😂 Reactions": ["😂", "😭", "😍", "🥺", "😤", "🙄", "😏", "🤔", "😬", "🤗", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "🥰", "🤩", "🥳", "😌", "😔", "🤕", "🤑", "🤠"],
};
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function EmojiPicker({ onSelect, onClose }) {
    const [tab, setTab] = useState(Object.keys(EMOJI_CATEGORIES)[0]);
    const ref = useRef(null);
    useEffect(() => {
        function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [onClose]);

    return (
        <div ref={ref} style={{
            position: "absolute", bottom: "calc(100% + 10px)", left: 0,
            width: "min(260px, calc(100vw - 32px))", maxHeight: "min(240px, 35vh)",
            background: "var(--color-background-primary)",
            border: "1px solid var(--color-border-secondary)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            zIndex: 100, overflow: "hidden",
            display: "flex", flexDirection: "column",
        }}>
            <div style={{ flexShrink: 0, display: "flex", borderBottom: "1px solid var(--color-border-tertiary)", padding: "4px 4px 0", gap: 1, overflowX: "auto" }}>
                {Object.keys(EMOJI_CATEGORIES).map(cat => (
                    <button key={cat} onClick={() => setTab(cat)} style={{
                        padding: "4px 6px", fontSize: 11, borderRadius: "5px 5px 0 0",
                        border: "none", cursor: "pointer", whiteSpace: "nowrap",
                        background: tab === cat ? "var(--color-background-secondary)" : "transparent",
                        color: tab === cat ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                        fontWeight: tab === cat ? 600 : 400,
                    }}>{cat}</button>
                ))}
            </div>
            <div style={{ padding: 4, overflowY: "auto", flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(28px, 1fr))", gap: 1 }}>
                    {EMOJI_CATEGORIES[tab].map(e => (
                        <button key={e} onClick={() => onSelect(e)} style={{
                            fontSize: 14, padding: "1px", border: "none",
                            background: "transparent", cursor: "pointer", borderRadius: 4,
                            lineHeight: 1.3, transition: "background 0.1s",
                        }}
                            onMouseEnter={ev => ev.currentTarget.style.background = "var(--color-background-secondary)"}
                            onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}
                        >{e}</button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Image Preview Modal ───────────────────────────────────────────────────────
function ImagePreviewModal({ file, objectUrl, onConfirm, onCancel, uploading }) {
    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.65)",
            padding: "16px",
        }}>
            <div style={{
                background: "var(--color-background-primary)",
                borderRadius: 16,
                border: "1px solid var(--color-border-secondary)",
                width: "100%", maxWidth: 400, padding: 20,
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)" }}>Send image</span>
                    <button onClick={onCancel} style={{ background: "var(--color-background-secondary)", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 16, lineHeight: 1, width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
                <div style={{ borderRadius: 12, overflow: "hidden", background: "var(--color-background-secondary)", marginBottom: 12, maxHeight: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={objectUrl} alt="Preview" style={{ maxHeight: 260, maxWidth: "100%", objectFit: "contain" }} />
                </div>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file?.name}</p>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={onConfirm} disabled={uploading} style={{
                        flex: 1, padding: "10px 0", background: "var(--primary)", color: "#fff",
                        border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14,
                        cursor: "pointer", opacity: uploading ? 0.6 : 1,
                    }}>{uploading ? "Sending…" : "Send"}</button>
                    <button onClick={onCancel} disabled={uploading} style={{
                        padding: "10px 18px", background: "none", border: "1px solid var(--color-border-secondary)",
                        borderRadius: 10, color: "var(--color-text-primary)", cursor: "pointer", fontWeight: 500, fontSize: 14,
                    }}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

// ── Add Member Modal ──────────────────────────────────────────────────────────
function AddMemberModal({ activeGroup, groupMembers, onClose, onAdded }) {
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState("email");
    const [adding, setAdding] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        const val = query.trim().toLowerCase();
        if (!val) return;
        setAdding(true);
        const tid = toast.loading("Looking up user…");
        try {
            let userId = null, userEmail = null;
            if (mode === "email") {
                const { data, error } = await supabase.rpc("get_user_id_by_email", { lookup_email: val });
                if (error) throw error;
                userId = data; userEmail = val;
            } else {
                const searchUsername = val.replace(/^@/, '');
                const { data, error } = await supabase.rpc("get_user_by_username", { lookup_username: searchUsername.toLowerCase() });
                if (error) throw error;
                if (data?.length > 0) { userId = data[0].user_id; userEmail = data[0].user_email; }
            }
            if (!userId) { toast.error(`No account found for "${val}".`, { id: tid }); return; }
            const alreadyIn = groupMembers.some(m => m.user_id === userId);
            if (alreadyIn) { toast.error("This user is already a member.", { id: tid }); return; }
            const { error: ie } = await supabase.from("chat_group_members").insert([{ group_id: activeGroup.id, user_id: userId, user_email: userEmail }]);
            if (ie) throw ie;
            toast.success(`Added to #${activeGroup.name}!`, { id: tid });
            setQuery(""); onAdded();
        } catch (err) {
            toast.error("Error: " + err.message, { id: tid });
        } finally { setAdding(false); }
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]/30 w-full max-w-sm rounded-[24px] p-6 shadow-2xl animate-springUp relative overflow-hidden">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="font-bold text-lg text-[var(--on-surface)] m-0 tracking-tight">Add to {activeGroup.name}</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] transition-colors border-none cursor-pointer">✕</button>
                </div>
                <div className="flex gap-1 bg-[var(--surface-container)] p-1 rounded-xl mb-5">
                    {["email", "username"].map(m => (
                        <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all border-none ${mode === m ? "bg-[var(--surface-container-lowest)] text-[var(--on-surface)] shadow-sm" : "bg-transparent text-[var(--on-surface-variant)] cursor-pointer hover:text-[var(--on-surface)]"}`}>
                            By {m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                    ))}
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <input autoFocus type={mode === "email" ? "email" : "text"} placeholder={mode === "email" ? "teammate@example.com" : "@username"}
                            value={query} onChange={e => setQuery(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-[var(--surface-container)] border border-[var(--outline-variant)]/20 text-[var(--on-surface)] text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium placeholder-[var(--on-surface-variant)] dark:border-transparent"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={adding || !query.trim()} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none border-none cursor-pointer">
                            {adding ? "Adding…" : "Add Member"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Create DM Modal ───────────────────────────────────────────────────────────
function CreateDMModal({ currentUser, onClose, onCreated }) {
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState("email");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        const val = query.trim().toLowerCase();
        if (!val) return;
        setLoading(true);
        const tid = toast.loading("Searching…");
        try {
            let userId = null, userEmail = "", userName = "";
            if (mode === "email") {
                const { data, error } = await supabase.rpc("get_user_id_by_email", { lookup_email: val });
                if (error) throw error;
                userId = data; userEmail = val; userName = val.split("@")[0];
            } else {
                const searchUsername = val.replace(/^@/, '');
                const { data, error } = await supabase.rpc("get_user_by_username", { lookup_username: searchUsername });
                if (error) throw error;
                if (data?.length > 0) { userId = data[0].user_id; userEmail = data[0].user_email; userName = searchUsername; }
            }
            if (!userId) { toast.error(`No account found.`, { id: tid }); return; }
            if (userId === currentUser.id) { toast.error("Can't DM yourself.", { id: tid }); return; }

            const { data: myM } = await supabase.from("chat_group_members").select("group_id").eq("user_id", currentUser.id);
            const myIds = myM?.map(m => m.group_id) || [];
            if (myIds.length > 0) {
                const { data: shared } = await supabase.from("chat_group_members")
                    .select("group_id, chat_groups!inner(name,type)")
                    .eq("user_id", userId)
                    .in("group_id", myIds)
                    .eq("chat_groups.type", "direct");
                if (shared?.length > 0) {
                    const { data: gd } = await supabase.from("chat_groups").select("*").eq("id", shared[0].group_id).single();
                    toast.success("Opened existing conversation", { id: tid });
                    onCreated(gd); return;
                }
            }

            const myName = getDisplayName(currentUser);
            const dmName = `DM: ${myName} & ${userName}`;
            const { data: ng, error: ge } = await supabase.from("chat_groups").insert([{ name: dmName, type: "direct", created_by: currentUser.id }]).select("*").single();
            if (ge) throw ge;
            await supabase.from("chat_group_members").insert([
                { group_id: ng.id, user_id: currentUser.id, user_email: currentUser.email || "" },
                { group_id: ng.id, user_id: userId, user_email: userEmail },
            ]);
            toast.success("Direct message started!", { id: tid });
            onCreated(ng);
        } catch (err) {
            toast.error("Error: " + err.message, { id: tid });
        } finally { setLoading(false); }
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]/30 w-full max-w-sm rounded-[24px] p-6 shadow-2xl animate-springUp  dark:border-transparent relative overflow-hidden">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="font-bold text-lg text-[var(--on-surface)] m-0 tracking-tight">New Message</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] transition-colors border-none cursor-pointer">✕</button>
                </div>
                <div className="flex gap-1 bg-[var(--surface-container)] p-1 rounded-xl mb-5">
                    {["email", "username"].map(m => (
                        <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all border-none ${mode === m ? "bg-[var(--surface-container-lowest)] text-[var(--on-surface)] shadow-sm" : "bg-transparent text-[var(--on-surface-variant)] cursor-pointer hover:text-[var(--on-surface)]"}`}>
                            By {m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                    ))}
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <input autoFocus type={mode === "email" ? "email" : "text"} placeholder={mode === "email" ? "teammate@example.com" : "@username"}
                            value={query} onChange={e => setQuery(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-[var(--surface-container)] border border-[var(--outline-variant)]/20 text-[var(--on-surface)] text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium placeholder-[var(--on-surface-variant)]"
                        />
                    </div>
                    <div className="pt-2">
                        <button type="submit" disabled={loading || !query.trim()} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none border-none cursor-pointer">
                            {loading ? "Searching…" : "Start Chat"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Context Menu ──────────────────────────────────────────────────────────────
function ContextMenu({ x, y, isMe, msg, canEdit, canDeleteAll, onEdit, onReply, onPin, onCopy, onDownload, onDeleteForMe, onDeleteForAll, onClose }) {
    const ref = useRef(null);

    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        }
        const t = setTimeout(() => document.addEventListener("mousedown", handleClick), 50);
        return () => { clearTimeout(t); document.removeEventListener("mousedown", handleClick); };
    }, [onClose]);

    const menuW = 200;
    const menuH = 300;
    const safeX = Math.min(x, window.innerWidth - menuW - 8);
    const safeY = Math.min(y, window.innerHeight - menuH - 8);

    const menuStyle = {
        position: "fixed",
        top: safeY,
        left: safeX,
        background: "var(--surface-container-lowest, var(--color-background-primary))",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--color-border-secondary)",
        borderRadius: 12,
        padding: "4px 0",
        zIndex: 9999,
        boxShadow: "0 8px 30px rgba(0,0,0,0.35), 0 0 1px rgba(0,0,0,0.2)",
        minWidth: menuW,
        opacity: 1,
        animation: "ctxFadeIn .12s ease-out",
    };

    const itemStyle = (color = "var(--color-text-primary)") => ({
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", background: "none", border: "none",
        cursor: "pointer", fontSize: 13, color, textAlign: "left",
        transition: "background 0.1s",
        fontFamily: "inherit",
    });

    const divider = <div style={{ height: 1, background: "var(--color-border-tertiary)", margin: "4px 0" }} />;

    return (
        <div ref={ref} style={menuStyle}>
            <button style={itemStyle()} onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={onReply}>
                <span style={{ fontSize: 15 }}>↩️</span> Reply
            </button>
            {isMe && msg.content && canEdit && (
                <button style={itemStyle()} onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={onEdit}>
                    <span style={{ fontSize: 15 }}>✏️</span> Edit <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 2 }}>(15 min)</span>
                </button>
            )}
            <button style={itemStyle()} onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={onPin}>
                <span style={{ fontSize: 15 }}>📌</span> {msg.is_pinned ? "Unpin" : "Pin"} message
            </button>
            <button style={itemStyle()} onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={onCopy}>
                <span style={{ fontSize: 15 }}>📋</span> Copy text
            </button>
            {msg.file_url && (
                <button style={itemStyle()} onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={onDownload}>
                    <span style={{ fontSize: 15 }}>⬇️</span> Download image
                </button>
            )}
            {divider}
            <button style={itemStyle("#F59E0B")} onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={onDeleteForMe}>
                <span style={{ fontSize: 15 }}></span> Delete for me
            </button>
            {isMe && canDeleteAll && (
                <button style={itemStyle("#EF4444")} onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"} onMouseLeave={e => e.currentTarget.style.background = "none"} onClick={onDeleteForAll}>
                    <Trash size={15} /> Delete for everyone <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 2 }}>(1 hr)</span>
                </button>
            )}
        </div>
    );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isMe, isGroup, isFirstInGroup, isLastInGroup, onReact, myReactions, allReactions, isRead, onImageClick, onDeleteForMe, onDeleteForAll, onEdit, onContextMenu, replyToMsg }) {
    const [showReactPicker, setShowReactPicker] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState(msg.content || "");
    const pickerRef = useRef(null);

    useEffect(() => {
        if (!showReactPicker) return;
        function handleClick(e) {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowReactPicker(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [showReactPicker]);

    const reactionMap = (allReactions || []).reduce((acc, r) => {
        if (!acc[r.emoji]) acc[r.emoji] = [];
        acc[r.emoji].push(r);
        return acc;
    }, {});

    function handleEditSubmit() {
        if (editText.trim() && editText !== msg.content) {
            onEdit(msg.id, editText.trim());
        }
        setEditing(false);
    }

    const showHeader = isFirstInGroup !== false;
    const topSpacing = showHeader ? 10 : 1;

    return (
        <div className="group msg-row" style={{
            display: "flex",
            flexDirection: "column",
            alignItems: isMe ? "flex-end" : "flex-start",
            marginTop: topSpacing,
            marginBottom: 1,
            position: "relative",
            padding: "0 20px",
        }}>
            <div style={{
                position: "relative", display: "flex", alignItems: "flex-start",
                maxWidth: "min(88%, 580px)", gap: 8,
                flexDirection: isMe ? "row-reverse" : "row",
            }}>
                {!isMe && (
                    <div style={{ flexShrink: 0, width: 30, marginTop: 2 }}>
                        {showHeader ? <Avatar name={msg.user_name || "User"} size="sm" /> : null}
                    </div>
                )}

                <div style={{ flex: "0 1 auto", minWidth: 0, display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                    {showHeader && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2, flexDirection: isMe ? "row-reverse" : "row" }}>
                            <span className="display-font" style={{ fontSize: 12.5, fontWeight: 700, color: isMe ? "var(--primary)" : "var(--color-text-primary)" }}>{msg.user_name || (isMe ? "Me" : "User")}</span>
                            <span style={{ fontSize: 10, color: "var(--color-text-secondary)", opacity: 0.55 }}>{formatTimeFriendly(msg.created_at)}</span>
                        </div>
                    )}

                    <div
                        onContextMenu={e => { e.preventDefault(); onContextMenu(e, msg, isMe, () => { setEditing(true); }); }}
                        className="msg-bubble"
                        style={{
                            padding: msg.file_url && !msg.content ? "4px 4px 6px" : "6px 12px 6px",
                            background: isMe ? "var(--primary, #4F46E5)" : "var(--color-background-primary)",
                            color: isMe ? "#ffffff" : "var(--color-text-primary)",
                            borderRadius: isMe
                                ? (showHeader ? "16px 4px 16px 16px" : "16px 4px 4px 16px")
                                : (showHeader ? "4px 16px 16px 16px" : "4px 16px 16px 4px"),
                            border: isMe ? "none" : "1px solid var(--color-border-tertiary)",
                            wordBreak: "break-word",
                            boxShadow: isMe ? "0 1px 4px rgba(99,102,241,0.12)" : "0 1px 2px rgba(0,0,0,0.04)",
                            cursor: "default", userSelect: "text",
                            transition: "box-shadow 0.15s, background 0.15s",
                        }}
                    >
                        {replyToMsg && (
                            <div style={{
                                borderLeft: "3px solid rgba(255,255,255,0.5)",
                                paddingLeft: 8, marginBottom: 4,
                                opacity: 0.7, fontSize: 12,
                                background: "rgba(0,0,0,0.1)",
                                borderRadius: "0 6px 6px 0",
                                padding: "4px 8px",
                            }}>
                                <span style={{ fontWeight: 700, display: "block", fontSize: 11 }}>{replyToMsg.user_name}</span>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: 200 }}>
                                    {replyToMsg.content || "📎 Image"}
                                </span>
                            </div>
                        )}
                        {msg.is_pinned && (
                            <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 2 }}>📌 Pinned</div>
                        )}
                        {editing ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                                <textarea
                                    autoFocus
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); } if (e.key === "Escape") setEditing(false); }}
                                    style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, color: "#fff", fontSize: 14, padding: "6px 8px", resize: "none", outline: "none", minHeight: 56 }}
                                    rows={2}
                                />
                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                    <button onClick={() => setEditing(false)} style={{ fontSize: 12, padding: "3px 10px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                                    <button onClick={handleEditSubmit} style={{ fontSize: 12, padding: "3px 10px", background: "rgba(255,255,255,0.9)", color: "var(--primary)", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>Save</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {msg.content && (
                                    <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>
                                        {msg.content}
                                        {msg.is_edited && <span style={{ fontSize: 10, opacity: 0.45, marginLeft: 4 }}>(edited)</span>}
                                    </p>
                                )}
                                {msg.file_url && (
                                    <div
                                        onClick={() => onImageClick(msg.file_url)}
                                        style={{ marginTop: msg.content ? 6 : 0, cursor: "pointer", borderRadius: 10, overflow: "hidden", display: "inline-block" }}
                                    >
                                        <img src={msg.file_url} onLoad={() => { const feed = document.querySelector('.msg-feed'); if (feed) feed.scrollTop = feed.scrollHeight; }} alt={msg.file_name || "image"} style={{ maxWidth: "min(280px, calc(100vw - 120px))", maxHeight: 240, display: "block", objectFit: "cover", borderRadius: 10 }} />
                                    </div>
                                )}
                            </>
                        )}
                        {isMe && !editing && (
                            <div style={{ display: "flex", justifyContent: "flex-end", position: "relative", right: -4, marginTop: 2, height: 4 }}>
                                <svg width="16" height="10" viewBox="0 0 16 11" fill="none" style={{ flexShrink: 0, position: "absolute", bottom: -2 }}>
                                    {isRead ? (
                                        <>
                                            <path d="M1 5.5L4.5 9L10 3" stroke="#4FC3F7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M5 5.5L8.5 9L14 3" stroke="#4FC3F7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        </>
                                    ) : (
                                        <>
                                            <path d="M1 5.5L4.5 9L10 3" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M5 5.5L8.5 9L14 3" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        </>
                                    )}
                                </svg>
                            </div>
                        )}
                    </div>

                    {Object.keys(reactionMap).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2, justifyContent: isMe ? "flex-end" : "flex-start", position: "relative", zIndex: 1 }}>
                            {Object.entries(reactionMap).map(([emoji, users]) => (
                                <button key={emoji} onClick={() => onReact(msg.id, emoji)} className="reaction-btn" style={{
                                    display: "flex", alignItems: "center", gap: 3,
                                    background: myReactions?.includes(emoji) ? "rgba(99,102,241,0.15)" : "var(--color-background-secondary)",
                                    border: myReactions?.includes(emoji) ? "1px solid rgba(99,102,241,0.4)" : "1px solid var(--color-border-secondary)",
                                    borderRadius: 20, padding: "2px 7px", cursor: "pointer", fontSize: 13,
                                    transition: "all 0.12s",
                                }}>
                                    <span>{emoji}</span>
                                    <span style={{ fontSize: 10, color: "var(--color-text-secondary)", fontWeight: 600 }}>{users.length}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div ref={pickerRef} style={{ position: "relative", alignSelf: "center", flexShrink: 0 }}>
                    <button
                        onClick={() => setShowReactPicker(v => !v)}
                        className={`react-trigger transition-opacity duration-150 ${showReactPicker ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-secondary)", cursor: "pointer", fontSize: 14, padding: "3px 6px", borderRadius: 20, lineHeight: 1 }}
                        title="React"
                    >😊</button>

                    {showReactPicker && (
                        <div style={{
                            position: "absolute", bottom: "calc(100% + 6px)",
                            [isMe ? "right" : "left"]: 0,
                            display: "flex", gap: 4, background: "var(--color-background-primary)",
                            border: "1px solid var(--color-border-secondary)", borderRadius: 24,
                            padding: "6px 10px", zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                            whiteSpace: "nowrap",
                        }}>
                            {QUICK_REACTIONS.map(e => (
                                <button key={e} onClick={() => { onReact(msg.id, e); setShowReactPicker(false); }}
                                    style={{
                                        fontSize: 20, background: "none", border: "none", cursor: "pointer",
                                        padding: "0 3px", borderRadius: 4, lineHeight: 1.4,
                                        transform: myReactions?.includes(e) ? "scale(1.25)" : "scale(1)",
                                        transition: "transform 0.1s",
                                    }}
                                >{e}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Lightbox Modal ────────────────────────────────────────────────────────────
function LightboxModal({ src, onClose }) {
    useEffect(() => {
        function handleKey(e) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onClose]);

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
            onClick={onClose}
        >
            <button
                onClick={onClose}
                style={{ position: "absolute", top: 20, right: 24, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}
                title="Close (ESC)"
            >✕</button>
            <img
                src={src}
                alt="Full size"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: "95vw", maxHeight: "75vh", objectFit: "contain", borderRadius: 12, boxShadow: "0 8px 60px rgba(0,0,0,0.6)" }}
            />
            <a
                href={src}
                download="image"
                onClick={e => e.stopPropagation()}
                style={{ marginTop: 20, background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", padding: "10px 24px", color: "white", textDecoration: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, border: "1px solid rgba(255,255,255,0.2)" }}
            >⬇ Download</a>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 10 }}>Click outside or press ESC to close</p>
        </div>
    );
}

// ── Typing Dots ───────────────────────────────────────────────────────────────
function TypingDots({ names }) {
    if (!names?.length) return null;
    const label = names.length === 1 ? `${names[0]} is typing` : names.length === 2 ? `${names[0]} and ${names[1]} are typing` : "Several people are typing";
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 12px" }}>
            <div style={{ display: "flex", gap: 2 }}>
                {[0, 1, 2].map(i => (
                    <span key={i} style={{
                        width: 5, height: 5, borderRadius: "50%", background: "var(--color-text-secondary)",
                        display: "inline-block", opacity: 0.6,
                        animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                ))}
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", opacity: 0.8 }}>{label}</span>
            <style>{`@keyframes typingBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}}`}</style>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MessengerPage() {
    const [channels, setChannels] = useState([]);
    const [dms, setDms] = useState([]);
    const [activeGroup, setActiveGroup] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [groupMembers, setGroupMembers] = useState([]);

    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [creatingGroup, setCreatingGroup] = useState(false);

    const [isAddingMember, setIsAddingMember] = useState(false);
    const [isCreatingDM, setIsCreatingDM] = useState(false);
    const [isRightBarOpen, setIsRightBarOpen] = useState(false);
    const [viewingImage, setViewingImage] = useState(null);

    const [pendingFile, setPendingFile] = useState(null);
    const [pendingObjectUrl, setPendingObjectUrl] = useState(null);
    const [uploading, setUploading] = useState(false);

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [reactions, setReactions] = useState({});
    const [typingUsers, setTypingUsers] = useState([]);
    const [readReceipts, setReadReceipts] = useState({});
    const [mutedGroups, setMutedGroups] = useState(() => typeof window !== "undefined" ? JSON.parse(localStorage.getItem("mutedGroups") || "[]") : []);
    const [blockedUsers, setBlockedUsers] = useState(() => typeof window !== "undefined" ? JSON.parse(localStorage.getItem("blockedUsers") || "[]") : []);
    const [searchQuery, setSearchQuery] = useState("");
    const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
    const [chatSearchQuery, setChatSearchQuery] = useState("");
    const [groupLastRead, setGroupLastRead] = useState({});

    useEffect(() => {
        if (!typingUsers.length) return;
        const timer = setTimeout(() => { setTypingUsers([]); }, 5000);
        return () => clearTimeout(timer);
    }, [typingUsers]);

    const [contextMenu, setContextMenu] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [replyingTo, setReplyingTo] = useState(null);
    const [pinnedMsg, setPinnedMsg] = useState(null);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const myDisplayName = currentUser ? getDisplayName(currentUser) : "";

    // ── Auth ────────────────────────────────────────────────────────────────
    useEffect(() => {
        async function init() {
            const { data } = await supabase.auth.getUser();
            if (data?.user) {
                setCurrentUser(data.user);
                updateLastSeen(data.user.id);
                loadMyGroups(data.user.id);
            }
        }
        init();
        const interval = setInterval(() => {
            supabase.auth.getUser().then(({ data }) => { if (data?.user) updateLastSeen(data.user.id); });
        }, 120000);
        return () => clearInterval(interval);
    }, []);

    async function updateLastSeen(userId) {
        await supabase.from("profiles").upsert({ id: userId, last_seen: new Date().toISOString() }, { onConflict: "id" });
    }

    useEffect(() => {
        if (!currentUser) return;
        const ch = supabase.channel("group-memberships")
            .on("postgres_changes", { event: "*", schema: "public", table: "chat_group_members", filter: `user_id=eq.${currentUser.id}` }, () => loadMyGroups(currentUser.id))
            .subscribe();

        const globalMsgCh = supabase.channel("global-messages")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, payload => {
                const newMsg = payload.new;
                const isIncoming = newMsg.user_id !== currentUser.id;
                const updateGroup = g => g.id === newMsg.group_id
                    ? { ...g, lastMessage: newMsg, unreadCount: (g.unreadCount || 0) + (isIncoming ? 1 : 0) }
                    : g;
                setChannels(prev => { if (prev.some(g => g.id === newMsg.group_id)) return prev.map(updateGroup); return prev; });
                setDms(prev => { if (prev.some(g => g.id === newMsg.group_id)) return prev.map(updateGroup); return prev; });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ch);
            supabase.removeChannel(globalMsgCh);
        };
    }, [currentUser?.id]);

    function playDingSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 600;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) { }
    }

    useEffect(() => {
        if (!activeGroup) return;
        setLoadingMessages(true);
        loadMessages(activeGroup.id);
        loadGroupMembers(activeGroup.id);
        loadReactions(activeGroup.id);
        markAsRead(activeGroup.id);
        loadPinnedMessage(activeGroup.id);

        const ch = supabase.channel(`room-${activeGroup.id}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `group_id=eq.${activeGroup.id}` }, payload => {
                setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
                scrollToBottom();
                markAsRead(activeGroup.id);
                if (payload.new.user_id !== currentUser?.id) playDingSound();
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `group_id=eq.${activeGroup.id}` }, payload => {
                const updated = payload.new;
                setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
                if (updated.is_pinned) setPinnedMsg(updated);
                else setPinnedMsg(prev => prev?.id === updated.id ? null : prev);
            })
            .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages", filter: `group_id=eq.${activeGroup.id}` }, payload => {
                setMessages(prev => prev.filter(m => m.id !== payload.old.id));
                setPinnedMsg(prev => prev?.id === payload.old.id ? null : prev);
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => loadReactions(activeGroup.id))
            .on("postgres_changes", { event: "*", schema: "public", table: "typing_indicators", filter: `group_id=eq.${activeGroup.id}` }, () => loadTyping(activeGroup.id))
            .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, () => loadReadReceipts(activeGroup.id))
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [activeGroup?.id, currentUser?.id]);

    useEffect(() => () => { if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl); }, [pendingObjectUrl]);

    // FIX 1: Simplified scrollToBottom — the feed is now a proper scroll container
    // so a single rAF is all that's needed; the mass of setTimeouts was a symptom
    // of the container not being properly constrained.
    function scrollToBottom() {
        const feed = document.querySelector('.msg-feed');
        if (feed) feed.scrollTop = feed.scrollHeight;
    }

    useEffect(() => {
        const feed = document.querySelector('.msg-feed');
        if (!feed) return;
        feed.scrollTop = feed.scrollHeight;
        const t1 = setTimeout(() => { if (feed) feed.scrollTop = feed.scrollHeight; }, 100);
        const t2 = setTimeout(() => { if (feed) feed.scrollTop = feed.scrollHeight; }, 300);
        const t3 = setTimeout(() => { if (feed) feed.scrollTop = feed.scrollHeight; }, 600);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [messages, activeGroup?.id]);

    async function loadMyGroups(userId, justLeft = false) {
        if (!userId) return;
        setLoadingGroups(true);
        const { data: myReads } = await supabase.from("message_reads").select("group_id, last_read_at").eq("user_id", userId);
        const readsMap = {};
        if (myReads) {
            myReads.forEach(r => { readsMap[r.group_id] = new Date(r.last_read_at).getTime(); });
            setGroupLastRead(readsMap);
        }

        const { data: memberships } = await supabase.from("chat_group_members").select("group_id").eq("user_id", userId);
        const ids = memberships?.map(m => m.group_id) || [];
        if (ids.length === 0) { setChannels([]); setDms([]); setLoadingGroups(false); return; }

        const { data: groupData } = await supabase.from("chat_groups").select("*").in("id", ids).order("created_at", { ascending: false });
        const fetched = groupData || [];

        const enriched = await Promise.all(fetched.map(async g => {
            const readTime = new Date(readsMap[g.id] || 0).toISOString();
            const { count } = await supabase.from("chat_messages").select('*', { count: 'exact', head: true }).eq("group_id", g.id).neq("user_id", userId).gt("created_at", readTime);
            const { data: msg } = await supabase.from("chat_messages").select("content, created_at, user_id").eq("group_id", g.id).order("created_at", { ascending: false }).limit(1);
            return { ...g, lastMessage: msg?.[0], unreadCount: count || 0 };
        }));

        setChannels(enriched.filter(g => g.type !== "direct"));
        setDms(enriched.filter(g => g.type === "direct"));

        const allGroups = enriched;
        setActiveGroup(prev => {
            if (justLeft) return null;
            if (prev) return allGroups.find(g => g.id === prev.id) || null;
            return null;
        });
        setLoadingGroups(false);
    }

    async function loadMessages(groupId) {
        setLoadingMessages(true);
        const { data, error } = await supabase.from("chat_messages").select("*").eq("group_id", groupId).order("created_at", { ascending: true });
        if (!error && data) {
            setMessages(data);
            scrollToBottom();
            if (data.length > 0) {
                const msgIds = data.map(m => m.id);
                const { data: rxns } = await supabase.from("message_reactions").select("*").in("message_id", msgIds);
                if (rxns) {
                    const map = {};
                    rxns.forEach(r => { if (!map[r.message_id]) map[r.message_id] = []; map[r.message_id].push(r); });
                    setReactions(map);
                }
            }
        }
        setLoadingMessages(false);
    }

    async function loadGroupMembers(groupId) {
        const { data: members } = await supabase.from("chat_group_members").select("user_id, user_email").eq("group_id", groupId);
        if (!members) { setGroupMembers([]); return; }
        const { data: profiles } = await supabase.from("profiles").select("id, last_seen, avatar_url").in("id", members.map(m => m.user_id));
        const now = new Date();
        setGroupMembers(members.map(m => {
            const prof = profiles?.find(p => p.id === m.user_id);
            const isOnline = prof?.last_seen ? (now - new Date(prof.last_seen)) < 3.5 * 60 * 1000 : false;
            return { ...m, isOnline, avatar_url: prof?.avatar_url };
        }));
    }

    async function loadReactions(groupId) {
        const { data: currentMessages } = await supabase.from("chat_messages").select("id").eq("group_id", groupId);
        const msgIds = currentMessages?.map(m => m.id) || [];
        if (!msgIds.length) return;
        const { data } = await supabase.from("message_reactions").select("*").in("message_id", msgIds);
        if (!data) return;
        const map = {};
        data.forEach(r => { if (!map[r.message_id]) map[r.message_id] = []; map[r.message_id].push(r); });
        setReactions(map);
    }

    async function loadTyping(groupId) {
        const { data } = await supabase.from("typing_indicators").select("user_name, user_id, updated_at").eq("group_id", groupId);
        if (!data) return;
        const now = new Date();
        const active = data.filter(t => t.user_id !== currentUser?.id && (now - new Date(t.updated_at)) < 5000);
        setTypingUsers(active.map(t => t.user_name));
    }

    async function loadReadReceipts(groupId) {
        if (!currentUser || messages.length === 0) return;
        const { data } = await supabase.from("message_reads").select("user_id, last_read_at").eq("group_id", groupId);
        if (!data) return;
        const otherReads = data.filter(r => r.user_id !== currentUser.id);
        if (!otherReads.length) return;
        const latestOtherRead = new Date(Math.max(...otherReads.map(r => new Date(r.last_read_at))));
        const receipts = {};
        messages.forEach(m => { if (m.user_id === currentUser.id) receipts[m.id] = new Date(m.created_at) <= latestOtherRead; });
        setReadReceipts(receipts);
    }

    async function markAsRead(groupId) {
        if (!currentUser) return;
        const nowIso = new Date().toISOString();
        await supabase.from("message_reads").upsert({ group_id: groupId, user_id: currentUser.id, last_read_at: nowIso }, { onConflict: "group_id,user_id" });
        setGroupLastRead(prev => ({ ...prev, [groupId]: new Date(nowIso).getTime() }));
        setChannels(prev => prev.map(g => g.id === groupId ? { ...g, unreadCount: 0 } : g));
        setDms(prev => prev.map(g => g.id === groupId ? { ...g, unreadCount: 0 } : g));
    }

    async function handleTyping() {
        if (!activeGroup || !currentUser) return;
        await supabase.from("typing_indicators").upsert({
            group_id: activeGroup.id, user_id: currentUser.id, user_name: myDisplayName, updated_at: new Date().toISOString()
        }, { onConflict: "group_id,user_id" });
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            supabase.from("typing_indicators").delete().eq("group_id", activeGroup.id).eq("user_id", currentUser.id);
        }, 3000);
    }

    async function handleCreateGroup(e) {
        e.preventDefault();
        let name = newGroupName.trim();
        if (!name || !currentUser || creatingGroup) return;
        name = name.charAt(0).toUpperCase() + name.slice(1);
        const exists = channels.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (exists) { toast.error("Channel name already exists!"); return; }
        setCreatingGroup(true);
        const tid = toast.loading("Creating channel…");
        const { data: grp, error } = await supabase.from("chat_groups").insert([{ name: name, created_by: currentUser.id, type: "channel" }]).select();
        if (error) { toast.error(error.message, { id: tid }); setCreatingGroup(false); return; }
        const group = grp[0];
        await supabase.from("chat_group_members").insert([{ group_id: group.id, user_id: currentUser.id, user_email: currentUser.email || "unknown" }]);
        toast.success("Channel created!", { id: tid });
        setNewGroupName(""); setIsCreatingGroup(false); setActiveGroup(group); setShowSidebar(false);
        loadMyGroups(currentUser.id); setCreatingGroup(false);
    }

    async function loadPinnedMessage(groupId) {
        const { data } = await supabase.from("chat_messages").select("*").eq("group_id", groupId).eq("is_pinned", true).limit(1).maybeSingle();
        setPinnedMsg(data || null);
    }

    async function handleSendMessage(e) {
        e?.preventDefault();
        if (!newMessage.trim() || !activeGroup || !currentUser) return;
        const msg = newMessage.trim();
        const replyRef = replyingTo ? { reply_to_id: replyingTo.id } : {};
        setNewMessage("");
        setReplyingTo(null);
        clearTimeout(typingTimeoutRef.current);
        await supabase.from("typing_indicators").delete().eq("group_id", activeGroup.id).eq("user_id", currentUser.id);
        await supabase.from("chat_messages").insert([{ group_id: activeGroup.id, user_id: currentUser.id, user_name: myDisplayName, content: msg, ...replyRef }]);
        scrollToBottom();
    }

    async function handleReact(messageId, emoji) {
        if (!currentUser) return;
        const existing = reactions[messageId]?.find(r => r.user_id === currentUser.id && r.emoji === emoji);
        if (existing) {
            await supabase.from("message_reactions").delete().eq("id", existing.id);
        } else {
            await supabase.from("message_reactions").insert([{ message_id: messageId, user_id: currentUser.id, user_name: myDisplayName, emoji }]);
        }
        loadReactions(activeGroup?.id);
    }

    function handleDeleteForMe(messageId) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        if (pinnedMsg?.id === messageId) setPinnedMsg(null);
    }

    async function handleDeleteForAll(messageId) {
        const msg = messages.find(m => m.id === messageId);
        setMessages(prev => prev.filter(m => m.id !== messageId));
        if (pinnedMsg?.id === messageId) setPinnedMsg(null);
        if (msg?.file_url) {
            try {
                const path = msg.file_url.split("/screenshots/")[1];
                if (path) await supabase.storage.from("screenshots").remove([path]);
            } catch { }
        }
        await supabase.from("chat_messages").delete().eq("id", messageId);
    }

    async function handlePinMessage(msg) {
        const newPinned = !msg.is_pinned;
        if (newPinned) {
            await supabase.from("chat_messages").update({ is_pinned: false }).eq("group_id", activeGroup.id).eq("is_pinned", true);
        }
        await supabase.from("chat_messages").update({ is_pinned: newPinned }).eq("id", msg.id);
        setMessages(prev => prev.map(m => ({ ...m, is_pinned: newPinned && m.id === msg.id ? true : false })));
        setPinnedMsg(newPinned ? { ...msg, is_pinned: true } : null);
        toast.success(newPinned ? "📌 Message pinned" : "Message unpinned");
    }

    async function handleEditMessage(messageId, newContent) {
        await supabase.from("chat_messages").update({ content: newContent, is_edited: true }).eq("id", messageId);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, is_edited: true } : m));
    }

    function handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { toast.error("Please select an image."); return; }
        if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB."); return; }
        setPendingFile(file);
        setPendingObjectUrl(URL.createObjectURL(file));
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    async function handleConfirmSend() {
        if (!pendingFile || !activeGroup || !currentUser) return;
        setUploading(true);
        const tid = toast.loading("Uploading…");
        try {
            const fileName = `${Date.now()}_${pendingFile.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
            const { data: uploadData, error: ue } = await supabase.storage.from("screenshots").upload(fileName, pendingFile, { cacheControl: "3600", upsert: false });
            if (ue) throw ue;
            const { data: { publicUrl } } = supabase.storage.from("screenshots").getPublicUrl(uploadData.path);
            const { error: de } = await supabase.from("chat_messages").insert([{ group_id: activeGroup.id, user_id: currentUser.id, user_name: myDisplayName, file_url: publicUrl, file_name: pendingFile.name }]);
            if (de) throw de;
            toast.success("Image sent!", { id: tid });
            scrollToBottom();
        } catch (err) { toast.error("Upload failed: " + err.message, { id: tid }); }
        finally {
            setUploading(false);
            URL.revokeObjectURL(pendingObjectUrl);
            setPendingFile(null); setPendingObjectUrl(null);
        }
    }

    function toggleMute(groupId) {
        const isMuted = mutedGroups.includes(groupId);
        const next = isMuted ? mutedGroups.filter(id => id !== groupId) : [...mutedGroups, groupId];
        setMutedGroups(next);
        localStorage.setItem("mutedGroups", JSON.stringify(next));
        toast.success(isMuted ? "Unmuted" : "Muted");
    }

    function toggleBlock(targetUserId) {
        const isBlocked = blockedUsers.includes(targetUserId);
        const next = isBlocked ? blockedUsers.filter(id => id !== targetUserId) : [...blockedUsers, targetUserId];
        setBlockedUsers(next);
        localStorage.setItem("blockedUsers", JSON.stringify(next));
        toast.success(isBlocked ? "Unblocked user" : "User blocked");
    }

    function confirmAction(message, onConfirm) {
        toast((t) => (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{message}</span>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => toast.dismiss(t.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Cancel</button>
                    <button onClick={() => { toast.dismiss(t.id); onConfirm(); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#EF4444", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Confirm</button>
                </div>
            </div>
        ), { duration: 5000 });
    }

    async function handleLeaveGroup() {
        if (!activeGroup || !currentUser) return;
        const msg = isDM ? "Delete this conversation?" : (currentUser.id === activeGroup.created_by ? "You are the admin. Leaving will delete this group. Continue?" : "Leave this channel?");

        confirmAction(msg, async () => {
            const tid = toast.loading(currentUser.id === activeGroup.created_by || isDM ? "Deleting…" : "Leaving…");
            if (currentUser.id === activeGroup.created_by || isDM) {
                await supabase.from("chat_groups").delete().eq("id", activeGroup.id);
                toast.success(isDM ? "Conversation deleted." : "Channel deleted.", { id: tid });
            } else {
                await supabase.from("chat_group_members").delete().eq("group_id", activeGroup.id).eq("user_id", currentUser.id);
                toast.success("Left channel.", { id: tid });
            }
            setActiveGroup(null);
            setMessages([]);
            setGroupMembers([]);
            setShowSidebar(true);
            loadMyGroups(currentUser.id, true);
        });
    }

    async function handleRemoveMember(memberId) {
        if (!activeGroup || currentUser?.id !== activeGroup.created_by) return;
        if (memberId === currentUser.id) return toast.error("Cannot remove yourself.");

        confirmAction("Remove this member?", async () => {
            await supabase.from("chat_group_members").delete().eq("group_id", activeGroup.id).eq("user_id", memberId);
            loadGroupMembers(activeGroup.id);
            toast.success("Member removed.");
        });
    }

    async function handleGroupAvatarUpload(e) {
        const file = e.target.files?.[0];
        if (!file || !activeGroup || currentUser?.id !== activeGroup.created_by) return;
        if (!file.type.startsWith("image/")) return toast.error("Please upload an image.");
        const tid = toast.loading("Updating photo…");
        const reader = new FileReader();
        reader.onload = async ev => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement("canvas");
                const MAX = 256;
                let w = img.width, h = img.height;
                if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                const b64 = canvas.toDataURL("image/jpeg", 0.8);
                const { error } = await supabase.from("chat_groups").update({ avatar_url: b64 }).eq("id", activeGroup.id);
                if (error) toast.error("Failed.", { id: tid });
                else { setActiveGroup(prev => ({ ...prev, avatar_url: b64 })); loadMyGroups(currentUser.id); toast.success("Updated!", { id: tid }); }
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = null;
    }

    function getDMTarget() {
        return groupMembers.find(m => m.user_id !== currentUser?.id);
    }

    function handleMessageContextMenu(e, msg, isMe, onEditCb) {
        e.preventDefault();
        const menuW = 200, menuH = 300;
        let x = e.clientX, y = e.clientY;
        if (x + menuW > window.innerWidth - 8) x = window.innerWidth - menuW - 8;
        if (y + menuH > window.innerHeight - 8) y = window.innerHeight - menuH - 8;
        const now = Date.now();
        const msgAge = now - new Date(msg.created_at).getTime();
        const canEdit = msgAge < 15 * 60 * 1000;
        const canDeleteAll = msgAge < 60 * 60 * 1000;
        setContextMenu({ x, y, msg, isMe, onEditCb, canEdit, canDeleteAll });
    }

    const isDM = activeGroup?.type === "direct";
    const isGroupChat = !isDM;
    const isMuted = mutedGroups.includes(activeGroup?.id);
    const dmTarget = isDM ? getDMTarget() : null;
    const dmTargetName = activeGroup ? getDMDisplayName(activeGroup.name, myDisplayName) : "";
    const isBlocked = dmTarget ? blockedUsers.includes(dmTarget.user_id) : false;

    const sortByRecent = (a, b) => {
        const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
        const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
        return timeB - timeA;
    };
    const filteredChannels = channels.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase())).sort(sortByRecent);
    const filteredDMs = dms.filter(g => getDMDisplayName(g.name, myDisplayName).toLowerCase().includes(searchQuery.toLowerCase())).sort(sortByRecent);

    const filteredChatMessages = messages.filter(m => !chatSearchQuery || m.content?.toLowerCase().includes(chatSearchQuery.toLowerCase()));
    const groupedMessages = filteredChatMessages.reduce((acc, msg) => {
        const label = formatDate(msg.created_at);
        if (!acc[label]) acc[label] = [];
        acc[label].push(msg);
        return acc;
    }, {});

    const headerName = isDM ? dmTargetName : activeGroup?.name;

    if (!currentUser) return null;

    return (
        <AppShell>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
                * { box-sizing: border-box; }

                /* Lock page scroll while in messenger */
                html, body { overflow: hidden !important; }

                .messenger-sidebar { font-family: 'Inter', sans-serif; }
                .display-font { font-family: 'Space Grotesk', sans-serif !important; }

                .messenger-scrollbar::-webkit-scrollbar { width: 4px; }
                .messenger-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .messenger-scrollbar::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 4px; }
                .messenger-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.35); }

                .channel-btn { font-family: inherit; }
                .channel-btn:hover { background: rgba(99,102,241,0.06) !important; }
                .channel-btn:active { transform: scale(0.985); }

                .action-icon { display: flex; align-items: center; }
                .action-icon:hover { background: var(--color-background-secondary) !important; color: var(--color-text-primary) !important; }
                .action-icon:active { transform: scale(0.9); }

                @keyframes ctxFadeIn { from { opacity:0; transform:scale(0.96) translateY(-4px); } to { opacity:1; transform:scale(1) translateY(0); } }

                .msg-row { transition: background 0.1s; border-radius: 6px; }
                .msg-row:hover { background: rgba(255,255,255,0.015); }
                .msg-row:hover .react-trigger { opacity: 1 !important; }

                .msg-bubble { transition: box-shadow 0.15s, transform 0.1s; }

                .reaction-btn:hover { filter: brightness(1.15); transform: scale(1.05); }

                .msg-center-col {
                    width: 100%;
                    max-width: clamp(600px, 70vw, 900px);
                    margin: 0 auto;
                }

                .chat-input-wrap:focus-within {
                    border-color: var(--primary) !important;
                    box-shadow: 0 0 0 2px rgba(99,102,241,0.12) !important;
                }

                .sidebar-section-label {
                    font-family: 'Space Grotesk', sans-serif;
                    font-size: 10px; font-weight: 700;
                    color: var(--color-text-secondary);
                    text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6;
                }

                .messenger-chat-area {
                    display: flex !important;
                    flex-direction: column !important;
                    overflow: hidden !important;
                    min-height: 0 !important;
                }

                /* The feed grows to fill remaining space and scrolls internally */
                .msg-feed {
                    flex: 1 1 0% !important;
                    min-height: 0 !important;
                    overflow-y: auto !important;
                }

                /* Input wrapper must never shrink */
                .chat-input-section {
                    flex-shrink: 0 !important;
                    position: relative; /* for emoji picker absolute positioning */
                }

                /* Sidebar: only the list scrolls */
                .sidebar-list { flex: 1; overflow-y: auto; min-height: 0; padding: 4px 0; }

                .messenger-wrapper {
                    border-radius: 12px;
                    height: calc(100dvh - 64px);
                }

                @media (max-width: 768px) {
                    .messenger-wrapper {
                        border-radius: 0 !important;
                        height: auto !important;
                        width: 100% !important;
                        flex: 1 1 0% !important;
                        min-height: 0 !important;
                        position: relative !important;
                    }

                    .messenger-sidebar {
                        width: 100% !important; min-width: 0 !important;
                        border: none !important;
                        background: var(--color-background-primary) !important;
                        overflow-y: auto !important;
                        display: flex !important;
                        flex-direction: column !important;
                        padding-top: env(safe-area-inset-top, 0px) !important;
                        padding-bottom: env(safe-area-inset-bottom, 0px) !important;
                    }

                    /* Hide the sidebar when not active on mobile */
                    .messenger-sidebar-hidden {
                        display: none !important;
                    }

                    /* When sidebar is visible, hide the chat panel */
                    .messenger-sidebar:not(.messenger-sidebar-hidden) + .messenger-chat-area {
                        display: none !important;
                    }

                    /* Right sidebar hidden on mobile (same as before) */
                    .messenger-right-sidebar { display: none !important; }

                    .messenger-chat-area { min-width: 0 !important; width: 100% !important; }

                    .mobile-account-strip { display: none !important; }

                    nav.fixed.bottom-0 { display: none !important; }

                    .msg-row { padding-left: 8px !important; padding-right: 8px !important; }
                    .date-divider { margin: 14px 8px 8px !important; }
                    .msg-center-col { max-width: 100% !important; }

                    .action-icon { padding: 8px !important; }
                }

                /* Tablet */
                @media (min-width: 769px) {
                    .messenger-sidebar {
                        display: flex !important;
                        flex-direction: column !important;
                        width: 260px !important;
                        min-width: 230px !important;
                        max-width: 340px !important;
                    }
                    .mobile-back-btn { display: none !important; }
                }

                /* Desktop scaling */
                @media (min-width: 1280px) {
                    .messenger-wrapper { zoom: 1.05; }
                    .messenger-sidebar { width: 280px !important; }
                    .msg-center-col { max-width: min(860px, 68vw); }
                }
                @media (min-width: 1536px) {
                    .messenger-wrapper { zoom: 1.15; }
                    .messenger-sidebar { width: 320px !important; }
                    .msg-center-col { max-width: min(1000px, 70vw); }
                }
                @media (min-width: 1920px) {
                    .messenger-wrapper { zoom: 1.25; }
                }
            `}</style>

            {pendingFile && <ImagePreviewModal file={pendingFile} objectUrl={pendingObjectUrl} onConfirm={handleConfirmSend} onCancel={() => { URL.revokeObjectURL(pendingObjectUrl); setPendingFile(null); setPendingObjectUrl(null); }} uploading={uploading} />}
            {isAddingMember && activeGroup && <AddMemberModal activeGroup={activeGroup} groupMembers={groupMembers} onClose={() => setIsAddingMember(false)} onAdded={() => { loadGroupMembers(activeGroup.id); setIsAddingMember(false); }} />}
            {isCreatingDM && currentUser && <CreateDMModal currentUser={currentUser} onClose={() => setIsCreatingDM(false)} onCreated={ng => { setIsCreatingDM(false); setActiveGroup(ng); setShowSidebar(false); loadMyGroups(currentUser.id); }} />}
            {viewingImage && <LightboxModal src={viewingImage} onClose={() => setViewingImage(null)} />}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x} y={contextMenu.y}
                    msg={contextMenu.msg} isMe={contextMenu.isMe}
                    canEdit={contextMenu.canEdit} canDeleteAll={contextMenu.canDeleteAll}
                    onReply={() => { setReplyingTo(contextMenu.msg); setContextMenu(null); inputRef.current?.focus(); }}
                    onPin={() => { handlePinMessage(contextMenu.msg); setContextMenu(null); }}
                    onEdit={() => { contextMenu.onEditCb?.(); setContextMenu(null); }}
                    onCopy={() => { navigator.clipboard.writeText(contextMenu.msg.content || ""); setContextMenu(null); toast.success("Copied!"); }}
                    onDownload={() => { const a = document.createElement("a"); a.href = contextMenu.msg.file_url; a.download = contextMenu.msg.file_name || "image"; a.click(); setContextMenu(null); }}
                    onDeleteForMe={() => { handleDeleteForMe(contextMenu.msg.id); setContextMenu(null); }}
                    onDeleteForAll={() => { handleDeleteForAll(contextMenu.msg.id); setContextMenu(null); }}
                    onClose={() => setContextMenu(null)}
                />
            )}

            <div
                className="messenger-wrapper shadow-lg dark:shadow-none"
                style={{
                    display: "flex",
                    overflow: "hidden",
                    background: "var(--color-background-secondary)",
                }}
            >

                {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
                <aside className={`messenger-sidebar ${!showSidebar ? 'messenger-sidebar-hidden' : ''}`} style={{
                    flexShrink: 0,
                    display: "flex", flexDirection: "column", overflow: "hidden",
                    background: "var(--color-background-primary)",
                    borderRight: "1px solid var(--color-border-tertiary)",
                }}>
                    <div style={{ padding: "24px 14px 10px", borderBottom: "1px solid var(--color-border-tertiary)", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <span className="display-font" style={{ fontWeight: 700, fontSize: 17, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>Messages</span>
                        </div>
                        <div style={{ position: "relative" }}>
                            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary)", opacity: 0.5 }} />
                            <input type="text" placeholder="Search conversations…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 10, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", fontSize: 13, color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s, box-shadow 0.2s" }}
                                onFocus={e => { e.target.style.borderColor = "var(--primary)"; e.target.style.boxShadow = "0 0 0 2px rgba(99,102,241,0.1)"; }}
                                onBlur={e => { e.target.style.borderColor = "var(--color-border-secondary)"; e.target.style.boxShadow = "none"; }}
                            />
                        </div>
                    </div>

                    {/* Scrollable list */}
                    <div className="sidebar-list messenger-scrollbar">

                        {/* CHANNELS */}
                        <div style={{ padding: "10px 14px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span className="sidebar-section-label">Channels</span>
                            <button onClick={() => { setIsCreatingGroup(v => !v); setNewGroupName(""); }}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 18, padding: "0 2px", lineHeight: 1, borderRadius: 4, transition: "color 0.15s" }}
                                onMouseEnter={e => e.currentTarget.style.color = "var(--primary)"}
                                onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-secondary)"}
                                title="Create channel">+</button>
                        </div>

                        {isCreatingGroup && (
                            <form onSubmit={handleCreateGroup} style={{ padding: "4px 10px 8px", display: "flex", gap: 6 }}>
                                <input autoFocus type="text" placeholder="channel-name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} maxLength={40}
                                    style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 13, outline: "none" }} />
                                <button type="submit" disabled={creatingGroup || !newGroupName.trim()}
                                    style={{ padding: "6px 12px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 600, opacity: (creatingGroup || !newGroupName.trim()) ? 0.5 : 1 }}>Create</button>
                            </form>
                        )}

                        {loadingGroups ? (
                            <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>Loading…</div>
                        ) : filteredChannels.length === 0 ? (
                            <div style={{ padding: "6px 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>No channels yet.</div>
                        ) : filteredChannels.map(g => {
                            const active = activeGroup?.id === g.id;
                            const muted = mutedGroups.includes(g.id);
                            const selectGroup = () => { if (activeGroup?.id !== g.id) { setMessages([]); setActiveGroup(g); setShowSidebar(false); setIsRightBarOpen(false); setIsChatSearchOpen(false); setChatSearchQuery(""); } };
                            return (
                                <button key={g.id} onClick={selectGroup} className="channel-btn" style={{
                                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                                    padding: "8px 10px", border: "none", cursor: "pointer", textAlign: "left",
                                    background: active ? "rgba(99,102,241,0.12)" : "transparent",
                                    borderLeft: active ? "3px solid var(--primary)" : "3px solid transparent",
                                    borderRadius: active ? "0 8px 8px 0" : "0",
                                    transition: "all 0.12s ease",
                                }}
                                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(99,102,241,0.05)"; }}
                                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? "rgba(99,102,241,0.12)" : "transparent"; }}
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        background: active ? "rgba(99,102,241,0.18)" : "var(--color-background-secondary)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 13, color: active ? "var(--primary)" : "var(--color-text-secondary)",
                                        fontWeight: 700, flexShrink: 0, overflow: "hidden",
                                    }}>
                                        {g.avatar_url ? <img src={g.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <Avatar name={g.name} size="sm" />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4 }}>
                                            {/* Added `display-font` class so the desktop media-query font-size rule applies */}
                                            <span className="display-font" style={{ fontSize: 13.5, fontWeight: active ? 600 : 500, color: active ? "var(--primary)" : "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{g.name}</span>
                                            {g.lastMessage && <span style={{ fontSize: 10, color: "var(--color-text-secondary)", flexShrink: 0, opacity: 0.6 }}>{formatTimeFriendly(g.lastMessage.created_at)}</span>}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 3, overflow: "hidden" }}>
                                                {muted && <span style={{ fontSize: 10 }}>🔇</span>}
                                                <span style={{ fontSize: 11.5, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.7 }}>{g.lastMessage?.content || "No messages yet"}</span>
                                            </div>
                                            {g.unreadCount > 0 && (
                                                <div style={{ background: "#EF4444", color: "#fff", fontSize: 10, fontWeight: 800, minWidth: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px", borderRadius: 12, flexShrink: 0, boxShadow: "0 2px 8px rgba(239,68,68,0.4)", border: "2px solid var(--color-background-primary)" }}>{g.unreadCount > 99 ? '99+' : g.unreadCount}</div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}

                        {/* DIRECT MESSAGES */}
                        <div style={{ padding: "12px 14px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                            <span className="sidebar-section-label">Direct Messages</span>
                            <button onClick={() => setIsCreatingDM(true)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 18, padding: "0 2px", lineHeight: 1, borderRadius: 4, transition: "color 0.15s" }}
                                onMouseEnter={e => e.currentTarget.style.color = "var(--primary)"}
                                onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-secondary)"}
                                title="New DM">+</button>
                        </div>

                        {filteredDMs.length === 0 ? (
                            <div style={{ padding: "6px 16px", fontSize: 14, color: "var(--color-text-secondary)" }}>No direct messages yet.</div>
                        ) : filteredDMs.map(g => {
                            const active = activeGroup?.id === g.id;
                            const displayName = getDMDisplayName(g.name, myDisplayName);
                            const muted = mutedGroups.includes(g.id);
                            const dmOnline = groupMembers.find(m => m.user_id !== currentUser?.id && g.id === activeGroup?.id)?.isOnline;
                            const isOnlineSim = g.lastMessage ? (Date.now() - new Date(g.lastMessage.created_at).getTime() < 86400000) : false;
                            const isOnlineFinal = dmOnline !== undefined ? dmOnline : isOnlineSim;
                            const selectGroup = () => { if (activeGroup?.id !== g.id) { setMessages([]); setActiveGroup(g); setShowSidebar(false); setIsRightBarOpen(false); setIsChatSearchOpen(false); setChatSearchQuery(""); } };
                            return (
                                <button key={g.id} onClick={selectGroup} className="channel-btn" style={{
                                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                                    padding: "8px 10px", border: "none", cursor: "pointer", textAlign: "left",
                                    background: active ? "rgba(99,102,241,0.12)" : "transparent",
                                    borderLeft: active ? "3px solid var(--primary)" : "3px solid transparent",
                                    borderRadius: active ? "0 8px 8px 0" : "0",
                                    transition: "all 0.12s ease",
                                }}
                                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(99,102,241,0.05)"; }}
                                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? "rgba(99,102,241,0.12)" : "transparent"; }}
                                >
                                    <Avatar name={displayName} size="sm" online={isOnlineFinal} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4 }}>
                                            <span className="display-font" style={{ fontSize: 13.5, fontWeight: active ? 600 : 500, color: active ? "var(--primary)" : "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{displayName}</span>
                                            {g.lastMessage && <span style={{ fontSize: 10, color: "var(--color-text-secondary)", flexShrink: 0, opacity: 0.6 }}>{formatTimeFriendly(g.lastMessage.created_at)}</span>}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 3, overflow: "hidden" }}>
                                                {muted && <span style={{ fontSize: 10 }}>🔇</span>}
                                                <span style={{ fontSize: 11.5, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.7 }}>{g.lastMessage?.content || "Tap to chat"}</span>
                                            </div>
                                            {g.unreadCount > 0 && (
                                                <div style={{ background: "#EF4444", color: "#fff", fontSize: 10, fontWeight: 800, minWidth: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px", borderRadius: 12, flexShrink: 0, boxShadow: "0 2px 8px rgba(239,68,68,0.4)", border: "2px solid var(--color-background-primary)" }}>{g.unreadCount > 99 ? '99+' : g.unreadCount}</div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Removed My Account strip per user request */}
                </aside>

                <div className="messenger-chat-area" style={{
                    flex: 1, minWidth: 0,
                    background: "var(--color-background-tertiary)",
                }}>
                    {!activeGroup ? (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, height: "100%" }}>
                            <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--color-background-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>💬</div>
                            <p style={{ fontWeight: 700, fontSize: 17, color: "var(--color-text-primary)", margin: 0 }}>Select a conversation</p>
                            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>Choose a channel or start a new direct message</p>
                        </div>
                    ) : (
                        <>
                            {/* ── Chat header — flex-shrink:0, never scrolls away ── */}
                            <div style={{
                                minHeight: 54, padding: "0 12px",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                background: "var(--color-background-primary)",
                                borderBottom: "1px solid var(--color-border-tertiary)",
                                flexShrink: 0,
                                zIndex: 10,
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>

                                    <button className="mobile-back-btn" onClick={() => { setShowSidebar(true); setActiveGroup(null); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 4px 6px 0", color: "var(--color-text-secondary)", display: "flex", alignItems: "center", flexShrink: 0 }}>
                                        <ChevronLeft size={22} strokeWidth={2.5} />
                                    </button>
                                    {isDM ? (
                                        <Avatar name={dmTargetName} size="sm" online={dmTarget?.isOnline} />
                                    ) : (
                                        activeGroup.avatar_url ? (
                                            <img src={activeGroup.avatar_url} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} alt="" />
                                        ) : (
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                                                <Avatar name={activeGroup.name} size="sm" />
                                            </div>
                                        )
                                    )}
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <p className="display-font chat-header-name" style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", margin: 0, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{headerName}</p>
                                        {isDM ? (
                                            <p className="chat-header-sub" style={{ fontSize: 11, color: dmTarget?.isOnline ? "#22C55E" : "var(--color-text-secondary)", margin: 0, fontWeight: 500, opacity: 0.9 }}>{dmTarget?.isOnline ? "● Online" : "● Offline"}</p>
                                        ) : (
                                            <p className="chat-header-sub" style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0, opacity: 0.7 }}>{groupMembers.filter(m => m.isOnline).length} online · {groupMembers.length} members</p>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                                    <button className="action-icon" onClick={() => setIsChatSearchOpen(o => !o)} style={{ background: isChatSearchOpen ? "rgba(99,102,241,0.1)" : "transparent", border: "none", color: isChatSearchOpen ? "var(--primary)" : "var(--color-text-secondary)", cursor: "pointer", padding: "6px", borderRadius: 8, transition: "all 0.15s", display: "flex", alignItems: "center" }} title="Search in Chat"><Search size={18} /></button>
                                    {!isDM && (
                                        <button className="action-icon" onClick={() => setIsAddingMember(true)} style={{ background: "transparent", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "6px", borderRadius: 8, transition: "all 0.15s", display: "flex", alignItems: "center" }} title="Add Members"><UserPlus size={18} /></button>
                                    )}
                                    <button className="action-icon" onClick={() => setIsRightBarOpen(o => !o)}
                                        style={{ background: isRightBarOpen ? "rgba(99,102,241,0.1)" : "transparent", border: "none", cursor: "pointer", padding: "6px", borderRadius: 8, color: isRightBarOpen ? "var(--primary)" : "var(--color-text-secondary)", transition: "all 0.15s", display: "flex", alignItems: "center" }}
                                        title="Menu"
                                    >
                                        <Menu size={18} />
                                    </button>
                                </div>
                            </div>

                            {isChatSearchOpen && (
                                <div style={{
                                    padding: "8px 12px",
                                    background: "var(--color-background-primary)",
                                    borderBottom: "1px solid var(--color-border-tertiary)",
                                    display: "flex",
                                    flexShrink: 0,
                                    alignItems: "center",
                                    zIndex: 9,
                                }}>
                                    <input autoFocus type="text" placeholder="Search in this conversation..." value={chatSearchQuery} onChange={e => setChatSearchQuery(e.target.value)}
                                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 13, outline: "none", transition: "border 0.2s" }}
                                        onFocus={e => e.target.style.borderColor = "var(--primary)"}
                                        onBlur={e => e.target.style.borderColor = "var(--color-border-secondary)"}
                                    />
                                    <button onClick={() => { setIsChatSearchOpen(false); setChatSearchQuery(""); }} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", marginLeft: 8, fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
                                </div>
                            )}

                            {pinnedMsg && (
                                <div style={{
                                    padding: "6px 14px",
                                    background: "rgba(99,102,241,0.08)",
                                    borderBottom: "1px solid rgba(99,102,241,0.15)",
                                    display: "flex", alignItems: "center", gap: 8,
                                    flexShrink: 0,
                                }}>
                                    <span style={{ fontSize: 14 }}>📌</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pinned</span>
                                        <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {pinnedMsg.content || "📎 Image"}
                                        </p>
                                    </div>
                                    <button onClick={() => handlePinMessage(pinnedMsg)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 14, padding: "2px 4px" }} title="Unpin">✕</button>
                                </div>
                            )}

                            <div className="msg-feed messenger-scrollbar">
                                <div className="msg-center-col" style={{ paddingTop: 8, paddingBottom: 4 }}>
                                    {loadingMessages ? (
                                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
                                            <div style={{ width: 28, height: 28, border: "2.5px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                                            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)", fontSize: 14, paddingTop: 60 }}>
                                            <p style={{ fontSize: 44, marginBottom: 12 }}>👋</p>
                                            <p style={{ fontWeight: 600, fontSize: 16, color: "var(--color-text-primary)", marginBottom: 4 }}>Start the conversation</p>
                                            <p style={{ fontSize: 13, opacity: 0.7 }}>Say hello to {isDM ? dmTargetName : "#" + activeGroup?.name}</p>
                                        </div>
                                    ) : (

                                        Object.entries(groupedMessages).map(([date, msgs]) => (
                                            <div key={date}>
                                                <div className="date-divider" style={{ display: "flex", alignItems: "center", margin: "18px 20px 10px" }}>
                                                    <div style={{ flex: 1, height: 1, background: "var(--color-border-tertiary)", opacity: 0.4 }} />
                                                    <span style={{ fontSize: 10, color: "var(--color-text-secondary)", padding: "2px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.5, background: "var(--color-background-tertiary)", borderRadius: 10 }}>{date}</span>
                                                    <div style={{ flex: 1, height: 1, background: "var(--color-border-tertiary)", opacity: 0.4 }} />
                                                </div>
                                                {msgs.map((msg, idx) => {
                                                    const isMe = msg.user_id === currentUser.id;
                                                    if (!isMe && isBlocked) return null;
                                                    const prevMsg = idx > 0 ? msgs[idx - 1] : null;
                                                    const nextMsg = idx < msgs.length - 1 ? msgs[idx + 1] : null;
                                                    const isFirstInGroup = !prevMsg || prevMsg.user_id !== msg.user_id;
                                                    const isLastInGroup = !nextMsg || nextMsg.user_id !== msg.user_id;
                                                    const replyToMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
                                                    return (
                                                        <MessageBubble
                                                            key={msg.id}
                                                            msg={msg}
                                                            isMe={isMe}
                                                            isGroup={isGroupChat}
                                                            isFirstInGroup={isFirstInGroup}
                                                            isLastInGroup={isLastInGroup}
                                                            onReact={handleReact}
                                                            myReactions={reactions[msg.id]?.filter(r => r.user_id === currentUser.id).map(r => r.emoji)}
                                                            allReactions={reactions[msg.id]}
                                                            isRead={readReceipts[msg.id]}
                                                            onImageClick={setViewingImage}
                                                            onDeleteForMe={handleDeleteForMe}
                                                            onDeleteForAll={handleDeleteForAll}
                                                            onEdit={handleEditMessage}
                                                            onContextMenu={handleMessageContextMenu}
                                                            replyToMsg={replyToMsg}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} style={{ height: 1 }} />
                                </div>
                            </div>

                            {/* Blocked notice */}
                            {isBlocked && (
                                <div style={{ padding: "10px 16px", background: "var(--color-background-primary)", borderTop: "1px solid var(--color-border-tertiary)", textAlign: "center", fontSize: 13, color: "var(--color-text-secondary)", flexShrink: 0 }}>
                                    You have blocked this user. <button onClick={() => toggleBlock(dmTarget?.user_id)} style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Unblock</button>
                                </div>
                            )}


                            {!isBlocked && (
                                <div className="chat-input-section" style={{
                                    padding: "8px 0 calc(8px + env(safe-area-inset-bottom, 0px)) 0",
                                    background: "var(--color-background-primary)",
                                    borderTop: "1px solid var(--color-border-tertiary)",
                                }}>
                                    {showEmojiPicker && (
                                        <div style={{ padding: "0 16px", position: "relative" }}>
                                            <EmojiPicker
                                                onSelect={e => { setNewMessage(prev => prev + e); inputRef.current?.focus(); }}
                                                onClose={() => setShowEmojiPicker(false)}
                                            />
                                        </div>
                                    )}
                                    {typingUsers?.length > 0 && (
                                        <div style={{ marginBottom: 2, padding: "0 16px" }}>
                                            <TypingDots names={typingUsers} />
                                        </div>
                                    )}
                                    {/* Reply bar */}
                                    {replyingTo && (
                                        <div style={{
                                            display: "flex", alignItems: "center", gap: 8,
                                            padding: "6px 16px",
                                            background: "rgba(99,102,241,0.06)",
                                            borderTop: "1px solid rgba(99,102,241,0.15)",
                                        }}>
                                            <span style={{ fontSize: 13 }}>↩️</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>Replying to {replyingTo.user_name}</span>
                                                <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {replyingTo.content || "📎 Image"}
                                                </p>
                                            </div>
                                            <button onClick={() => setReplyingTo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}>✕</button>
                                        </div>
                                    )}
                                    <div className="msg-center-col" style={{ padding: "0 12px" }}>
                                        <div className="chat-input-wrap" style={{
                                            display: "flex", alignItems: "flex-end", gap: 6,
                                            background: "var(--color-background-secondary)",
                                            borderRadius: 20, padding: "8px 14px",
                                            border: "1px solid var(--color-border-secondary)",
                                            transition: "border-color 0.2s, box-shadow 0.2s",
                                        }}>
                                            <button onClick={() => setShowEmojiPicker(v => !v)}
                                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: 0, color: "var(--color-text-secondary)", flexShrink: 0, lineHeight: 1, transition: "all 0.1s", height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
                                                onMouseEnter={e => e.currentTarget.style.color = "var(--color-text-primary)"}
                                                onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-secondary)"}
                                                title="Emoji">😊</button>
                                            <button onClick={() => fileInputRef.current?.click()}
                                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-text-secondary)", flexShrink: 0, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s", height: 24 }}
                                                onMouseEnter={e => e.currentTarget.style.color = "var(--color-text-primary)"}
                                                onMouseLeave={e => e.currentTarget.style.color = "var(--color-text-secondary)"}
                                                title="Attach image">
                                                <Paperclip size={20} />
                                            </button>
                                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" style={{ display: "none" }} />
                                            <textarea
                                                ref={inputRef}
                                                value={newMessage}
                                                onChange={e => { setNewMessage(e.target.value); handleTyping(); }}
                                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                                placeholder={`Message ${isDM ? dmTargetName : "#" + activeGroup?.name}`}
                                                rows={1}
                                                style={{
                                                    flex: 1, background: "transparent", border: "none", outline: "none",
                                                    fontSize: 15, color: "var(--color-text-primary)", resize: "none",
                                                    lineHeight: "24px", padding: 0, margin: "0 4px", maxHeight: 120, overflowY: "auto",
                                                    fontFamily: "inherit",
                                                }}
                                            />
                                            <button
                                                onClick={handleSendMessage}
                                                disabled={!newMessage.trim()}
                                                style={{
                                                    width: 32, height: 32, borderRadius: "50%",
                                                    background: "#4F46E5",
                                                    border: "none", cursor: newMessage.trim() ? "pointer" : "default",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    flexShrink: 0, transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                                    opacity: newMessage.trim() ? 1 : 0.5,
                                                    transform: newMessage.trim() ? "scale(1.05)" : "scale(1)",
                                                    marginBottom: -4,
                                                }}
                                            >
                                                <SendHorizonal size={16} strokeWidth={2.5} color="#ffffff" style={{ marginLeft: 1 }} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────────── */}
                {activeGroup && isRightBarOpen && (
                    <aside className="messenger-right-sidebar messenger-scrollbar" style={{
                        width: 260, flexShrink: 0,
                        display: "flex", flexDirection: "column",
                        background: "var(--color-background-primary)",
                        borderLeft: "1px solid var(--color-border-tertiary)",
                        overflowY: "auto",
                    }}>
                        <div style={{ padding: "24px 18px 16px", textAlign: "center", borderBottom: "1px solid var(--color-border-tertiary)" }}>
                            {isDM ? (
                                <>
                                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                                        <Avatar name={dmTargetName} size="lg" online={dmTarget?.isOnline} />
                                    </div>
                                    <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: "var(--color-text-primary)" }}>{dmTargetName}</p>
                                    <span style={{ fontSize: 12, color: dmTarget?.isOnline ? "#22C55E" : "var(--color-text-secondary)", fontWeight: 500 }}>{dmTarget?.isOnline ? "● Online" : "● Offline"}</span>
                                </>
                            ) : (
                                <>
                                    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 10 }}>
                                        <div style={{ position: "relative", display: "inline-block" }}>
                                            {activeGroup.avatar_url ? (
                                                <img src={activeGroup.avatar_url} style={{ width: 60, height: 60, borderRadius: 16, objectFit: "cover" }} alt="" />
                                            ) : (
                                                <div style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden" }}>
                                                    <Avatar name={activeGroup.name} size="lg" />
                                                </div>
                                            )}
                                        </div>
                                        {currentUser?.id === activeGroup.created_by && (
                                            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, padding: "4px 10px", background: "var(--color-background-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: 12, cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", transition: "all 0.15s" }}
                                                onMouseEnter={e => { e.currentTarget.style.color = "var(--primary)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
                                                onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.borderColor = "var(--color-border-secondary)"; }}
                                            >
                                                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleGroupAvatarUpload} />
                                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                                                Change Photo
                                            </label>
                                        )}
                                    </div>
                                    <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: "var(--color-text-primary)" }}>{activeGroup.name}</p>
                                    <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{groupMembers.length} members</span>
                                </>
                            )}
                        </div>

                        <div style={{ padding: "12px 14px", flex: 1 }}>
                            {!isDM && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Members ({groupMembers.length})</span>
                                        <button onClick={() => setIsAddingMember(true)} style={{ fontSize: 11, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add</button>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {groupMembers.slice(0, 6).map(m => (
                                            <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <Avatar name={m.user_email?.split("@")[0]} size="sm" online={m.isOnline} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.user_email?.split("@")[0]}</p>
                                                    <p style={{ fontSize: 10, color: m.isOnline ? "#22C55E" : "var(--color-text-secondary)", margin: 0, fontWeight: 500 }}>{m.isOnline ? "Online" : "Offline"}</p>
                                                </div>
                                                {currentUser?.id === activeGroup.created_by && m.user_id !== currentUser.id && (
                                                    <button onClick={() => handleRemoveMember(m.user_id)} style={{ fontSize: 11, color: "#EF4444", background: "rgba(239, 68, 68, 0.1)", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, fontWeight: 600, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}>Remove</button>
                                                )}
                                            </div>
                                        ))}
                                        {groupMembers.length > 6 && <button onClick={() => setIsAddingMember(true)} style={{ fontSize: 12, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontWeight: 500 }}>+{groupMembers.length - 6} more…</button>}
                                    </div>
                                </div>
                            )}

                            {messages.filter(m => m.file_url).length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>Media ({messages.filter(m => m.file_url).length})</span>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
                                        {messages.filter(m => m.file_url).slice(-9).reverse().map(m => (
                                            <div key={m.id} onClick={() => setViewingImage(m.file_url)} style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden", cursor: "pointer" }}>
                                                <img src={m.file_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="media" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--color-border-tertiary)", display: "flex", flexDirection: "column", gap: 6 }}>
                            <button onClick={() => toggleMute(activeGroup.id)} style={{ padding: "9px 0", borderRadius: 10, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "background 0.1s" }}>
                                {isMuted ? "🔔 Unmute" : "🔇 Mute"}
                            </button>
                            {isDM && dmTarget && (
                                <button onClick={() => toggleBlock(dmTarget.user_id)} style={{ padding: "9px 0", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "none", color: "#EF4444", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                                    {isBlocked ? "✓ Unblock User" : "⊘ Block User"}
                                </button>
                            )}
                            <button onClick={handleLeaveGroup} style={{ padding: "9px 0", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "none", color: "#EF4444", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                                {currentUser?.id === activeGroup.created_by ? "🗑 Delete" : "← Leave"} {isDM ? "Conversation" : "Channel"}
                            </button>
                        </div>
                    </aside>
                )}
            </div>
        </AppShell>
    );
}