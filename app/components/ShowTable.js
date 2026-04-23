"use client";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import Dropdown from "./Dropdown";
import ConfirmModal from "./ConfirmModal";

function UserAvatar({ user, size = "w-8 h-8" }) {
    const [avatarUrl, setAvatarUrl] = useState(null);
    useEffect(() => {
        if (!user?.user_id) return;
        supabase.from('profiles').select('avatar_url').eq('id', user.user_id).single().then(({ data }) => {
            if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        });
    }, [user?.user_id]);

    const name = user?.user_name || "User";
    if (avatarUrl) {
        return <img src={avatarUrl} alt={name} className={`inline-block ${size} rounded-full ring-2 ring-white object-cover`} title={name} />;
    }
    return (
        <div className={`inline-block ${size} rounded-full ring-2 ring-white bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300`} title={name}>
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

export default function ShowTable({ logs: initialLogs }) {
    const [logs, setLogs] = useState(initialLogs);
    const [selectedRows, setSelectedRows] = useState([]);
    const [editingNotes, setEditingNotes] = useState(null);
    const [editingPriority, setEditingPriority] = useState(null);
    const [editingPromo, setEditingPromo] = useState(null);
    const [tempNotes, setTempNotes] = useState("");
    const [editingShowConfig, setEditingShowConfig] = useState(null); // ID of show being configured (priority/promo)
    const [tempConfigPromo, setTempConfigPromo] = useState("");
    const [expandedShows, setExpandedShows] = useState({});
    const [copiedPromo, setCopiedPromo] = useState(null);

    // Join Show Modal State
    const [showJoinModal, setShowJoinModal] = useState(null);
    const [joinForm, setJoinForm] = useState({
        name: "",
        email: "",
        checkStartDate: "",
        checkEndDate: ""
    });
    const [currentUser, setCurrentUser] = useState(null);

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: "",
        message: "",
        isDanger: true,
        confirmText: "Confirm",
        onConfirm: () => { }
    });

    // Edit User Modal State
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({
        checkStartDate: "",
        checkEndDate: ""
    });
    const [isAdmin, setIsAdmin] = useState(false);

    // Search, Sort, Filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("created_at_asc");
    const [filterPriority, setFilterPriority] = useState("all");

    // Screenshot state
    const [screenshots, setScreenshots] = useState({});
    const [uploadingShow, setUploadingShow] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);
    const fileInputRef = useRef(null);
    const activeUploadShowRef = useRef(null);

    useEffect(() => {
        setLogs(initialLogs);
    }, [initialLogs]);

    // Fetch screenshots for expanded shows
    useEffect(() => {
        const expandedIds = Object.entries(expandedShows).filter(([, v]) => v).map(([k]) => k);
        expandedIds.forEach(id => {
            if (!screenshots[id]) fetchScreenshots(id);
        });
    }, [expandedShows]);

    async function fetchScreenshots(showId) {
        try {
            const { data, error } = await supabase
                .from("screenshot_uploads")
                .select("*")
                .eq("show_id", showId)
                .order("created_at", { ascending: false });
            if (!error && data) {
                setScreenshots(prev => ({ ...prev, [showId]: data }));
            }
        } catch (e) { }
    }

    async function logActivity(action, description, showId = null) {
        if (!currentUser) return;
        const userName = getUserDisplayName();
        try {
            await supabase.from("activity_log").insert([{
                user_id: currentUser.id,
                user_name: userName,
                action,
                description,
                show_id: showId
            }]);
        } catch (e) {
            console.error("Failed to log activity:", e);
        }
    }

    function getUserDisplayName() {
        if (!currentUser) return "User";
        const first = currentUser.user_metadata?.first_name || "";
        const last = currentUser.user_metadata?.last_name || "";
        const username = currentUser.user_metadata?.username || "";
        return (first && last) ? `${first} ${last}` : username || currentUser.email?.split('@')[0] || "User";
    }

    useEffect(() => {
        async function getCurrentUser() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUser(user);

                // Check admin: try profiles table first, fallback to metadata
                let isAdminUser = user.user_metadata?.is_admin === true;
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('is_admin')
                        .eq('id', user.id)
                        .single();
                    if (profile?.is_admin === true) isAdminUser = true;
                } catch (e) {
                    // profiles table may not exist yet — use metadata
                }
                setIsAdmin(isAdminUser);

                const firstName = user.user_metadata?.first_name || "";
                const lastName = user.user_metadata?.last_name || "";
                const username = user.user_metadata?.username || "";
                const displayName = (firstName && lastName)
                    ? `${firstName} ${lastName}`
                    : username || user.email?.split('@')[0] || "";
                setJoinForm(prev => ({
                    ...prev,
                    name: displayName,
                    email: user.email || ""
                }));
            }
        }
        getCurrentUser();
    }, []);

    // Open Join Modal
    function openJoinModal(showId) {
        setShowJoinModal(showId);
        if (currentUser) {
            const firstName = currentUser.user_metadata?.first_name || "";
            const lastName = currentUser.user_metadata?.last_name || "";
            const username = currentUser.user_metadata?.username || "";
            const displayName = (firstName && lastName)
                ? `${firstName} ${lastName}`
                : username || currentUser.email?.split('@')[0] || "";
            setJoinForm({
                name: displayName,
                email: currentUser.email || "",
                checkStartDate: "",
                checkEndDate: ""
            });
        }
    }

    // Open Edit Modal
    function openEditModal(user) {
        setEditingUser(user);
        setEditForm({
            checkStartDate: user.check_start_date || "",
            checkEndDate: user.check_end_date || ""
        });
    }

    // Handle Edit Submit
    // Handle Edit Submit (User Dates)
    async function handleEditSubmit() {
        if (!editingUser) return;

        const { error } = await supabase.from("show_participants").update({
            check_start_date: editForm.checkStartDate || null,
            check_end_date: editForm.checkEndDate || null
        }).eq("id", editingUser.id);

        if (!error) {
            setLogs(prev => prev.map(log =>
                log.id === editingUser.show_id ? {
                    ...log,
                    show_participants: log.show_participants.map(u =>
                        u.id === editingUser.id ? { ...u, check_start_date: editForm.checkStartDate, check_end_date: editForm.checkEndDate } : u
                    )
                } : log
            ));
            setEditingUser(null);
            toast.success("User dates updated");
        } else {
            toast.error("Failed to update user: " + error.message);
        }
    }
    // Desktop row priority style - only glowing edges
    function getPriorityRowClass(color) {
        const base = "rounded-lg shadow-sm bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50 transition-all";
        switch (color) {
            case 'red': case 'high':
                return `${base} ring-1 ring-inset ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)] dark:shadow-[0_0_12px_rgba(239,68,68,0.6)]`;
            case 'orange': case 'medium':
                return `${base} ring-1 ring-inset ring-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.4)] dark:shadow-[0_0_12px_rgba(251,146,60,0.6)]`;
            case 'yellow': case 'low':
                return `${base} ring-1 ring-inset ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)] dark:shadow-[0_0_12px_rgba(250,204,21,0.6)]`;
            case 'green':
                return `${base} ring-1 ring-inset ring-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] dark:shadow-[0_0_12px_rgba(16,185,129,0.6)]`;
            default:
                return `${base} ring-1 ring-inset ring-gray-200/60 dark:ring-slate-700/60`;
        }
    }

    // Mobile card priority style - only glowing edges
    function getPriorityCardClass(color) {
        const base = "bg-white dark:bg-slate-900 transition-all hover:shadow-md";
        switch (color) {
            case 'red': case 'high':
                return `${base} ring-1 ring-inset ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)] dark:shadow-[0_0_12px_rgba(239,68,68,0.6)]`;
            case 'orange': case 'medium':
                return `${base} ring-1 ring-inset ring-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.4)] dark:shadow-[0_0_12px_rgba(251,146,60,0.6)]`;
            case 'yellow': case 'low':
                return `${base} ring-1 ring-inset ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)] dark:shadow-[0_0_12px_rgba(250,204,21,0.6)]`;
            case 'green':
                return `${base} ring-1 ring-inset ring-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] dark:shadow-[0_0_12px_rgba(16,185,129,0.6)]`;
            default:
                return `${base} border border-gray-200 dark:border-slate-700 shadow-sm`;
        }
    }

    // Mobile priority badge
    function getPriorityBadge(color) {
        switch (color) {
            case 'red': case 'high': return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/20">High</span>;
            case 'orange': case 'medium': return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500 border border-orange-500/20">Medium</span>;
            case 'yellow': case 'low': return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-500 border border-yellow-400/20">Low</span>;
            default: return null;
        }
    }

    // ── Admin Helper ──────────────────────────────────────────────────────────────
    // Supabase user_metadata set during signUp lives in raw_user_meta_data and is
    // reflected server-side immediately, but the client JWT may lag until next sign-in.
    // We check three sources so validation works even right after first registration.
    async function checkIsAdmin() {
        if (!currentUser) return false;
        // 1. Already in JWT user_metadata (most common after re-login)
        if (currentUser.user_metadata?.is_admin === true) return true;
        // 2. In app_metadata (set by Supabase triggers or admin API)
        if (currentUser.app_metadata?.is_admin === true) return true;
        // 3. Fallback: query profiles table
        const { data } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', currentUser.id)
            .single();
        return data?.is_admin === true;
    }

    function toggleExpand(showId) {
        setExpandedShows(prev => ({ ...prev, [showId]: !prev[showId] }));
    }

    function handleDeleteShowClick(showId) {
        setConfirmModal({
            isOpen: true,
            title: "Delete Show",
            message: "Delete this show and all its user assignments? This action cannot be undone.",
            isDanger: true,
            confirmText: "Delete",
            onConfirm: () => executeDeleteShow(showId)
        });
    }

    async function executeDeleteShow(showId) {
        const adminOk = await checkIsAdmin();
        if (!adminOk) {
            toast.error("Only administrators can delete shows. Try signing out and back in.");
            return;
        }

        const toastId = toast.loading("Deleting show...");
        const showName = logs.find(l => l.id === showId)?.name || 'Unknown';

        // Log activity first with no showId to prevent cascade deletion
        logActivity('deleted_show', `${getUserDisplayName()} deleted show "${showName}"`);

        const { error } = await supabase.from("shows").delete().eq("id", showId);

        if (!error) {
            setLogs(prev => prev.filter(log => log.id !== showId));
            toast.success("Show deleted successfully", { id: toastId });
        } else {
            toast.error("Error deleting show: " + error.message, { id: toastId });
        }
    }



    function handleDeleteUserClick(userId, showId) {
        setConfirmModal({
            isOpen: true,
            title: "Remove User",
            message: "Are you sure you want to remove this user from the show?",
            isDanger: true,
            confirmText: "Remove",
            onConfirm: () => executeDeleteUser(userId, showId)
        });
    }

    async function executeDeleteUser(userId, showId) {
        const toastId = toast.loading("Removing user...");
        const { error } = await supabase.from("show_participants").delete().eq("id", userId);
        if (!error) {
            const showName = logs.find(l => l.id === showId)?.name || 'Unknown';
            setLogs(prev => prev.map(log =>
                log.id === showId ? {
                    ...log,
                    show_participants: log.show_participants.filter(u => u.id !== userId)
                } : log
            ));
            toast.success("User removed", { id: toastId });
            logActivity('left_show', `${getUserDisplayName()} left show "${showName}"`, showId);
        } else {
            toast.error("Error removing user: " + error.message, { id: toastId });
        }
    }

    function handleBulkDeleteClick() {
        if (selectedRows.length === 0) return;
        setConfirmModal({
            isOpen: true,
            title: "Bulk Delete",
            message: `Are you sure you want to delete ${selectedRows.length} selected show(s)?`,
            isDanger: true,
            confirmText: "Delete All",
            onConfirm: executeBulkDelete
        });
    }

    async function executeBulkDelete() {
        if (selectedRows.length === 0) return;
        const adminOk = await checkIsAdmin();
        if (!adminOk) {
            toast.error("Only administrators can bulk delete shows.");
            return;
        }

        const toastId = toast.loading(`Deleting ${selectedRows.length} shows...`);
        const { error } = await supabase.from("shows").delete().in("id", selectedRows);
        if (!error) {
            setLogs(prev => prev.filter(log => !selectedRows.includes(log.id)));
            setSelectedRows([]);
            toast.success("Shows deleted", { id: toastId });
        } else {
            toast.error("Error deleting shows: " + error.message, { id: toastId });
        }
    }

    function toggleRowSelection(id) {
        setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
    }

    function toggleSelectAll() {
        setSelectedRows(selectedRows.length === logs.length ? [] : logs.map(log => log.id));
    }

    // Config Logic (Priority & Promo)
    async function handleConfigSubmit(showId, colorToSave = null, promoToSave = null) {
        try {
            const show = logs.find(l => l.id === showId);
            const newColor = colorToSave !== null ? colorToSave : show.priority_color;
            const newPromo = promoToSave !== null ? promoToSave.trim() : tempConfigPromo.trim();

            const { error } = await supabase.from("shows").update({
                priority_color: newColor,
                promo_code: newPromo
            }).eq("id", showId);

            if (!error) {
                setLogs(prev => prev.map(log => log.id === showId ? { ...log, priority_color: newColor, promo_code: newPromo } : log));
                toast.success("Configuration saved");
            } else {
                toast.error("Failed to save changes: " + error.message);
            }
        } catch (err) {
            toast.error("Error: " + err.message);
        }
    }

    function handleCopy(text) {
        navigator.clipboard.writeText(text);
        setCopiedPromo(text);
        setTimeout(() => setCopiedPromo(null), 2000);
    }

    // Notes are in shows table (shared)
    async function handleNotesSubmit(showId) {
        console.log("Updating notes for show:", showId, "to:", tempNotes);

        try {
            const { data, error } = await supabase
                .from("shows")
                .update({ notes: tempNotes })
                .eq("id", showId)
                .select();

            if (error) {
                console.error("Error updating notes:", error);
                toast.error("Failed to update notes: " + error.message);
                return;
            }

            console.log("Notes updated successfully:", data);

            // Fetch show name for activity logging
            const showName = logs.find(l => l.id === showId)?.name || 'Unknown';
            if (!tempNotes.trim()) {
                logActivity('deleted_note', `${getUserDisplayName()} removed notes for show "${showName}"`, showId);
            } else {
                logActivity('updated_note', `${getUserDisplayName()} updated notes for show "${showName}"`, showId);
            }

            // Update local state
            setLogs(prev => prev.map(log =>
                log.id === showId ? { ...log, notes: tempNotes } : log
            ));
            setEditingNotes(null);
            setTempNotes("");
            toast.success("Notes saved");
        } catch (err) {
            console.error("Exception updating notes:", err);
            toast.error("Failed to update notes: " + err.message);
        }
    }

    async function handleJoinShow() {
        if (!joinForm.name.trim() || !showJoinModal || !currentUser) return;

        // Prevent duplicate: check if user already in this show
        const currentShow = logs.find(l => l.id === showJoinModal);
        const alreadyJoined = currentShow?.show_participants?.some(p => p.user_id === currentUser.id);
        if (alreadyJoined) {
            toast.error("You have already joined this show.");
            return;
        }

        // Build insert data object
        const insertData = {
            show_id: showJoinModal,
            user_id: currentUser.id,
            user_name: joinForm.name.trim(),
            check_start_date: joinForm.checkStartDate || null,
            check_end_date: joinForm.checkEndDate || null,
            status: false
        };

        const { data, error } = await supabase
            .from("show_participants")
            .insert([insertData])
            .select();

        if (error) {
            console.error("Error joining show:", error);
            if (error.code === "23505") { // Unique violation
                toast.error("You have already joined this show.");
            } else {
                toast.error(`Error joining show: ${error.message}`);
            }
            return;
        }

        if (data && data[0]) {
            const showName = logs.find(l => l.id === showJoinModal)?.name || 'Unknown';
            setLogs(prev => prev.map(log =>
                log.id === showJoinModal ? {
                    ...log,
                    show_participants: [...(log.show_participants || []), data[0]]
                } : log
            ));
            setExpandedShows(prev => ({ ...prev, [showJoinModal]: true }));
            logActivity('joined_show', `${getUserDisplayName()} joined show "${showName}"`, showJoinModal);
            setShowJoinModal(null);
            setJoinForm({ name: "", email: "", checkStartDate: "", checkEndDate: "" });
        }
    }

    // Toggle user status
    async function handleToggleUserStatus(user) {
        // Permission check: You can only toggle your OWN status
        if (user.user_id !== currentUser?.id) {
            toast.error("You can only change your own status.");
            return;
        }

        const newStatus = !user.status;
        const now = new Date();

        const updateData = {
            status: newStatus,
            last_checked_at: newStatus ? now.toISOString() : null,
            status_changed_at: now.toISOString()
        };

        const { error } = await supabase
            .from("show_participants")
            .update(updateData)
            .eq("id", user.id);

        if (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status: " + error.message);
            return;
        }

        // Update local state
        const showName = logs.find(l => l.id === user.show_id)?.name || 'Unknown';
        setLogs(prev => prev.map(log =>
            log.id === user.show_id ? {
                ...log,
                show_participants: log.show_participants.map(u =>
                    u.id === user.id ? { ...u, ...updateData, date_checked: now.toISOString().split('T')[0], time_checked: now.toTimeString().slice(0, 5) } : u
                )
            } : log
        ));
        logActivity(
            newStatus ? 'status_checked' : 'status_unchecked',
            `${getUserDisplayName()} marked "${showName}" as ${newStatus ? 'Checked' : 'Pending'}`,
            user.show_id
        );
    }

    // Screenshot upload handler
    async function handleScreenshotUpload(e, showId) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error("Please select an image file");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File must be under 5MB");
            return;
        }

        setUploadingShow(showId);
        const toastId = toast.loading("Uploading screenshot...");

        try {
            const ext = file.name.split('.').pop();
            const path = `${currentUser.id}/${showId}_${Date.now()}.${ext}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('screenshots')
                .upload(path, file);

            if (uploadError) {
                toast.error("Upload failed: " + uploadError.message, { id: toastId });
                setUploadingShow(null);
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('screenshots')
                .getPublicUrl(path);

            const { error: dbError } = await supabase.from("screenshot_uploads").insert([{
                show_id: showId,
                user_id: currentUser.id,
                user_name: getUserDisplayName(),
                file_url: publicUrl,
                file_name: file.name
            }]);

            if (dbError) {
                toast.error("Failed to save: " + dbError.message, { id: toastId });
            } else {
                toast.success("Screenshot uploaded!", { id: toastId });
                fetchScreenshots(showId);
                const showName = logs.find(l => l.id === showId)?.name || 'Unknown';
                logActivity('uploaded_screenshot', `${getUserDisplayName()} uploaded a screenshot for "${showName}"`, showId);
            }
        } catch (err) {
            toast.error("Upload error: " + err.message, { id: toastId });
        } finally {
            setUploadingShow(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function handleDeleteScreenshot(screenshotId, showId) {
        const { error } = await supabase.from("screenshot_uploads").delete().eq("id", screenshotId);
        if (!error) {
            toast.success("Screenshot deleted");
            fetchScreenshots(showId);
        } else {
            toast.error("Failed to delete: " + error.message);
        }
    }

    // ── Filtered & Sorted Logs ──────────────────────────────────────────────
    const priorityOrder = { red: 0, high: 0, orange: 1, medium: 1, yellow: 2, low: 2, green: 3, none: 4 };

    const filteredSortedLogs = React.useMemo(() => {
        let result = [...logs];

        // Filter by search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(log =>
                log.name?.toLowerCase().includes(q) ||
                log.notes?.toLowerCase().includes(q)
            );
        }

        // Filter by priority
        if (filterPriority !== "all") {
            result = result.filter(log => {
                const pc = log.priority_color || 'none';
                if (filterPriority === "none") return !pc || pc === 'none';
                return pc === filterPriority;
            });
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case "name_asc": return (a.name || '').localeCompare(b.name || '');
                case "name_desc": return (b.name || '').localeCompare(a.name || '');
                case "priority_high": return (priorityOrder[a.priority_color] ?? 4) - (priorityOrder[b.priority_color] ?? 4);
                case "priority_low": return (priorityOrder[b.priority_color] ?? 4) - (priorityOrder[a.priority_color] ?? 4);
                case "users_most": return (b.show_participants?.length || 0) - (a.show_participants?.length || 0);
                case "created_at_desc": return new Date(b.created_at) - new Date(a.created_at);
                case "created_at_asc":
                default: return new Date(a.created_at) - new Date(b.created_at);
            }
        });

        return result;
    }, [logs, searchQuery, sortBy, filterPriority]);

    // Hidden file input for screenshots
    const hiddenFileInput = (
        <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
                if (activeUploadShowRef.current) {
                    handleScreenshotUpload(e, activeUploadShowRef.current);
                }
            }}
        />
    );

    return (
        <div>
            {hiddenFileInput}

            {/* Search, Sort & Filter Bar */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search shows…"
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {/* Sort */}
                        <Dropdown
                            value={sortBy}
                            onChange={setSortBy}
                            options={[
                                { value: "created_at_asc", label: "Oldest First" },
                                { value: "created_at_desc", label: "Newest First" },
                                { value: "name_asc", label: "Name A–Z" },
                                { value: "name_desc", label: "Name Z–A" },
                                { value: "priority_high", label: "Priority ↑" },
                                { value: "priority_low", label: "Priority ↓" },
                                { value: "users_most", label: "Most Users" }
                            ]}
                            className="w-[140px]"
                            triggerClassName="w-full text-xs font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
                            dropdownClassName="min-w-[160px]"
                        />

                        {/* Filter Priority */}
                        <Dropdown
                            value={filterPriority}
                            onChange={setFilterPriority}
                            options={[
                                { value: "all", label: "All Priority" },
                                { value: "red", label: "🔴 High" },
                                { value: "orange", label: "🟠 Medium" },
                                { value: "yellow", label: "🟡 Low" },
                                { value: "none", label: "⚪ None" }
                            ]}
                            className="w-[130px]"
                            triggerClassName="w-full text-xs font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
                            dropdownClassName="min-w-[140px] right-0 sm:left-0 sm:right-auto"
                        />
                    </div>
                </div>
                {/* Results counter */}
                {(searchQuery || filterPriority !== "all") && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium">
                        Showing {filteredSortedLogs.length} of {logs.length} shows
                        {searchQuery && <> matching "<strong className="text-indigo-400">{searchQuery}</strong>"</>}
                    </p>
                )}
            </div>
            {/* Global Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                isDanger={confirmModal.isDanger}
                confirmText={confirmModal.confirmText}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />

            {/* Bulk Actions */}
            {selectedRows.length > 0 && (
                <div className="bg-indigo-50/80 dark:bg-indigo-900/30 backdrop-blur-sm border-b border-indigo-100 dark:border-indigo-800/50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sticky top-0 z-10">
                    <span className="text-sm text-indigo-900 dark:text-indigo-300 font-semibold">{selectedRows.length} selected</span>
                    <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                        <button onClick={toggleSelectAll} className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/40">
                            {selectedRows.length === logs.length ? "Deselect All" : "Select All"}
                        </button>
                        <button onClick={handleBulkDeleteClick} className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete
                        </button>
                    </div>
                </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto min-h-[500px] pb-10">
                <table className="min-w-full text-left border-separate border-spacing-y-2">
                    <thead>
                        <tr className="bg-gray-50/50 dark:bg-slate-800/80">
                            <th className="px-6 py-4 w-12 border-b border-gray-200 dark:border-slate-700 rounded-tl-lg rounded-bl-lg">
                                <input type="checkbox" checked={logs.length > 0 && selectedRows.length === logs.length} onChange={toggleSelectAll} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700">Show Name</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700">Notes</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center border-b border-gray-200 dark:border-slate-700">Users</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right border-b border-gray-200 dark:border-slate-700">Actions</th>
                            <th className="px-6 py-4 w-12 border-b border-gray-200 dark:border-slate-700 rounded-tr-lg rounded-br-lg"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-transparent">
                        {filteredSortedLogs.map(log => {
                            const users = log.show_participants || [];
                            const isExpanded = expandedShows[log.id];

                            return (
                                <React.Fragment key={log.id}>
                                    <tr className={`group transition-all duration-300 relative ${selectedRows.includes(log.id) ? 'rounded-lg bg-indigo-50/80 dark:bg-indigo-900/40 ring-1 ring-inset ring-indigo-500/50 shadow-md' : getPriorityRowClass(log.priority_color)} dark:text-gray-200`}>
                                        <td className="px-6 py-5 first:rounded-l-lg last:rounded-r-lg">
                                            <input type="checkbox" checked={selectedRows.includes(log.id)} onChange={() => toggleRowSelection(log.id)} className="h-4 w-4 rounded shadow-sm border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        </td>
                                        <td className="px-6 py-5 first:rounded-l-lg last:rounded-r-lg">
                                            <div className="flex items-center gap-3">
                                                <a href={log.url || "#"} target="_blank" rel="noopener noreferrer" className="group/link flex items-center gap-2">
                                                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover/link:text-indigo-600 dark:group-hover/link:text-indigo-400 transition-colors capitalize">{log.name}</span>
                                                    {log.url && (
                                                        <svg className="w-4 h-4 text-gray-400 group-hover/link:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    )}
                                                </a>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 first:rounded-l-lg last:rounded-r-lg max-w-[280px]">
                                            <div className="flex flex-col items-start gap-4">
                                                {editingNotes === log.id ? (
                                                    <div className="w-full relative">
                                                        <textarea
                                                            value={tempNotes}
                                                            onChange={e => setTempNotes(e.target.value)}
                                                            className="w-full text-sm p-3 border-gray-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 font-semibold shadow-sm"
                                                            rows={2}
                                                            autoFocus
                                                        />
                                                        <div className="absolute bottom-2 right-2 flex gap-1">
                                                            <button onClick={() => handleNotesSubmit(log.id)} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500">Save</button>
                                                            <button onClick={() => { setEditingNotes(null); setTempNotes(""); }} className="px-2 py-1 text-xs bg-white dark:bg-slate-700 border dark:border-slate-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-50">Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => { setEditingNotes(log.id); setTempNotes(log.notes || ""); }} className="text-left group/note w-full">
                                                        {log.notes ? (
                                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 leading-snug group-hover/note:text-indigo-600 dark:group-hover/note:text-indigo-400 transition-colors break-words whitespace-normal">{log.notes}</p>
                                                        ) : (
                                                            <span className="text-xs text-gray-400 font-medium group-hover/note:text-indigo-500 dashed-underline decoration-gray-300 cursor-pointer">+ Add Note</span>
                                                        )}
                                                    </button>
                                                )}

                                            </div>
                                        </td>
                                        <td className="px-6 py-5 first:rounded-l-lg last:rounded-r-lg">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="flex -space-x-2 overflow-hidden justify-center">
                                                    {users.slice(0, 3).map((u, i) => (
                                                        <UserAvatar key={i} user={u} />
                                                    ))}
                                                    {users.length > 3 && (
                                                        <div className="inline-flex h-8 w-8 rounded-full ring-2 ring-white dark:ring-transparent bg-gray-100 dark:bg-slate-700 items-center justify-center text-xs text-gray-600 dark:text-gray-300 font-bold z-10 flex-shrink-0">
                                                            +{users.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                                {users.length === 0 && <span className="text-xs text-gray-400 italic">No users</span>}
                                                {!users.some(u => u.user_id === currentUser?.id) && (
                                                    <button onClick={() => openJoinModal(log.id)} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors tracking-wide uppercase">
                                                        + Join
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium first:rounded-l-lg last:rounded-r-lg">
                                            <div className="flex justify-end gap-3 items-center">
                                                <button onClick={() => { setEditingShowConfig(log.id); setTempConfigPromo(log.promo_code || ""); }} className="text-gray-400 hover:text-indigo-500 transition-colors flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow" title="Edit Show config">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                {isAdmin && (
                                                    <button onClick={() => handleDeleteShowClick(log.id)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors" title="Delete Show">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <button onClick={() => toggleExpand(log.id)} className={`p-2 rounded-full transition-all duration-200 ${isExpanded ? 'bg-indigo-50 text-indigo-600 rotate-180' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expanded User Details - Desktop */}
                                    {isExpanded && (
                                        <tr className="bg-gray-50/50 dark:bg-slate-800/30">
                                            <td colSpan={6} className="px-6 py-4">
                                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm overflow-hidden ml-12 animate-fadeIn">
                                                    <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700/50 flex items-center justify-between bg-gray-50/30 dark:bg-slate-800/50">
                                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                            User Status Details
                                                        </h4>
                                                    </div>

                                                    {users.length === 0 ? (
                                                        <div className="p-8 text-center">
                                                            <div className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3">
                                                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                            </div>
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No users have joined yet.</p>
                                                            <button onClick={() => openJoinModal(log.id)} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">Add user now</button>
                                                        </div>
                                                    ) : (
                                                        <table className="min-w-full">
                                                            <thead>
                                                                <tr className="border-b border-gray-100 dark:border-slate-700/50 text-left">
                                                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                                                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Check Period</th>
                                                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Checked</th>
                                                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/30">
                                                                {users.map(user => (
                                                                    <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                                                                        <td className="px-6 py-4">
                                                                            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{user.user_name}</span>
                                                                            <div className="text-xs text-gray-400 dark:text-gray-500">{user.user_email}</div>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700">
                                                                                {user.check_start_date || 'N/A'} → {user.check_end_date || 'N/A'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-sm text-gray-600">
                                                                            {user.last_checked_at ? (
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-medium text-gray-300">{new Date(user.last_checked_at).toLocaleDateString()}</span>
                                                                                    <span className="text-sm text-gray-300">{new Date(user.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-gray-400">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <button
                                                                                onClick={() => handleToggleUserStatus(user)}
                                                                                disabled={user.user_id !== currentUser?.id}
                                                                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${user.user_id !== currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                                                                                    } ${user.status
                                                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200 ring-1 ring-green-600/20'
                                                                                        : 'bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-red-600/10'}`}
                                                                            >
                                                                                {user.status ? (
                                                                                    <>
                                                                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                                                        Checked
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <span className="w-2 h-2 rounded-full bg-red-400 mr-2 animate-pulse"></span>
                                                                                        Pending
                                                                                    </>
                                                                                )}
                                                                            </button>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <div className="flex items-center justify-end gap-2">
                                                                                {user.user_id === currentUser?.id && (
                                                                                    <>
                                                                                        <button onClick={() => openEditModal(user)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium hover:underline">Edit Date</button>
                                                                                        <span className="text-gray-300">|</span>
                                                                                        <button onClick={() => handleDeleteUserClick(user.id, log.id)} className="text-gray-400 hover:text-red-600 transition-colors text-xs font-medium">Leave</button>
                                                                                    </>
                                                                                )}
                                                                                {isAdmin && user.user_id !== currentUser?.id && (
                                                                                    <button onClick={() => handleDeleteUserClick(user.id, log.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Remove User">Remove</button>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}

                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-4 p-4">
                {filteredSortedLogs.map(log => {
                    const users = log.show_participants || [];
                    const isExpanded = expandedShows[log.id];

                    return (
                        <div key={log.id} className={`rounded-2xl overflow-hidden transition-all duration-300 ${selectedRows.includes(log.id) ? 'ring-2 ring-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/20' : getPriorityCardClass(log.priority_color)}`}>
                            <div className="p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3 w-full">
                                        <input type="checkbox" checked={selectedRows.includes(log.id)} onChange={() => toggleRowSelection(log.id)} className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <div className="flex flex-col relative w-full">
                                            <div className="flex items-center justify-between gap-2 w-full pr-8">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <a href={log.url || "#"} target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1 active:text-indigo-600">
                                                        {log.name}
                                                        {log.url && <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                                                    </a>
                                                    {getPriorityBadge(log.priority_color)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <button onClick={() => handleDeleteShow(log.id)} className="absolute right-4 text-gray-400 p-2 hover:text-red-500">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>

                                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3 group">
                                    {editingNotes === log.id ? (
                                        <div className="w-full relative">
                                            <textarea
                                                value={tempNotes}
                                                onChange={e => setTempNotes(e.target.value)}
                                                className="w-full text-sm p-2 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded focus:border-indigo-500 text-gray-900 dark:text-gray-100"
                                                rows={2}
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={() => handleNotesSubmit(log.id)} className="mt-2 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded">Save Notes</button>
                                                <button onClick={() => { setEditingNotes(null); setTempNotes(""); }} className="mt-2 text-xs bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-300 px-3 py-1.5 rounded">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div onClick={() => { setEditingNotes(log.id); setTempNotes(log.notes || ""); }}>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold mb-1">Notes</p>
                                            {log.notes ? <p className="text-sm text-gray-700 dark:text-gray-300">{log.notes}</p> : <p className="text-xs text-gray-400 italic">Tap to add notes</p>}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-end border-t border-gray-100 dark:border-slate-800 pt-3">
                                    <div className="flex gap-2 flex-wrap">
                                        <button onClick={() => { setEditingShowConfig(log.id); setTempConfigPromo(log.promo_code || ""); }} className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:text-indigo-500 rounded-lg text-xs font-bold uppercase flex items-center gap-1 transition-colors">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> Edit
                                        </button>
                                        {!users.some(u => u.user_id === currentUser?.id) && (
                                            <button onClick={() => openJoinModal(log.id)} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold uppercase transition-colors">Join</button>
                                        )}
                                        <button onClick={() => toggleExpand(log.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1 transition-colors ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'}`}>
                                            {users.length} Users
                                            <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Expanded Users */}
                            {isExpanded && (
                                <div className="border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30 p-4 space-y-3">
                                    {users.length === 0 ? <p className="text-center text-sm text-gray-500 dark:text-gray-400">No users yet.</p> : users.map(user => (
                                        <div key={user.id} className="bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{user.user_name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.user_email}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleUserStatus(user)}
                                                    disabled={user.user_id !== currentUser?.id}
                                                    className={`px-2 py-1 rounded-full border shadow-sm text-[10px] font-black uppercase tracking-wide transition-all ${user.user_id !== currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''} ${user.status ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}`}
                                                >
                                                    {user.status ? 'Checked' : 'Pending'}
                                                </button>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-slate-800 mt-2">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-600 dark:text-gray-300">Period</span>
                                                    <span>{user.check_start_date || 'N/A'} - {user.check_end_date || 'N/A'}</span>
                                                </div>
                                                {user.user_id === currentUser?.id && (
                                                    <div className="flex gap-3">
                                                        <button onClick={() => openEditModal(user)} className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> Edit</button>
                                                        <button onClick={() => handleDeleteUser(user.id, log.id)} className="font-bold text-red-500 hover:text-red-700 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> Leave</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="bg-indigo-50 rounded-full p-4 mb-4">
                        <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No shows yet</h3>
                    <p className="mt-1 text-gray-500 max-w-sm">Get started by creating a new show to track checks.</p>
                </div>
            )}

            {/* Join Show Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 transition-all">
                    <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 w-full sm:max-w-md ring-1 ring-black/5 dark:ring-transparent max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Join Show</h3>
                            <button onClick={() => { setShowJoinModal(null); setJoinForm({ name: "", email: "", checkStartDate: "", checkEndDate: "" }); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Full Name *</label>
                                <input type="text" value={joinForm.name} onChange={e => setJoinForm({ ...joinForm, name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white" placeholder="e.g. Jane Doe" autoFocus readOnly />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">This is automatically set from your profile</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
                                <input type="email" value={joinForm.email} onChange={e => setJoinForm({ ...joinForm, email: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white" placeholder="your@email.com" readOnly />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">This is automatically set from your account</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Check Start Date</label>
                                    <input type="date" value={joinForm.checkStartDate} onChange={e => setJoinForm({ ...joinForm, checkStartDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Check End Date</label>
                                    <input type="date" value={joinForm.checkEndDate} onChange={e => setJoinForm({ ...joinForm, checkEndDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-8">
                            <button onClick={() => { setShowJoinModal(null); setJoinForm({ name: "", email: "", checkStartDate: "", checkEndDate: "" }); }} className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
                            <button onClick={handleJoinShow} disabled={!joinForm.name.trim()} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">Join Show</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 transition-all">
                    <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 w-full sm:max-w-sm ring-1 ring-black/5 dark:ring-transparent">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Edit User Period</h3>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Editing: <strong className="text-gray-900 dark:text-white">{editingUser.user_name}</strong></p>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Check Start</label>
                                <input type="date" value={editForm.checkStartDate} onChange={e => setEditForm({ ...editForm, checkStartDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Check End</label>
                                <input type="date" value={editForm.checkEndDate} onChange={e => setEditForm({ ...editForm, checkEndDate: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-8">
                            <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
                            <button onClick={handleEditSubmit} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Show Config Modal (Priority & Promos) */}
            {editingShowConfig && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 transition-all p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 w-full max-w-sm ring-1 ring-black/5 dark:ring-transparent relative">
                        <button onClick={() => { setEditingShowConfig(null); setTempConfigPromo(""); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Edit Show Settings</h3>

                        <div className="space-y-6">
                            {/* Priority Selection */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Priority Level</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { color: 'red', label: 'High', classActive: 'bg-red-600 text-white shadow-md shadow-red-500/30 ring-2 ring-red-300', classInactive: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40' },
                                        { color: 'orange', label: 'Medium', classActive: 'bg-orange-500 text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-300', classInactive: 'bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/40' },
                                        { color: 'yellow', label: 'Low', classActive: 'bg-yellow-400 text-yellow-900 font-bold shadow-md shadow-yellow-400/30 ring-2 ring-yellow-200', classInactive: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/40' },
                                        { color: 'none', label: 'None', classActive: 'bg-gray-600 text-white shadow-md shadow-gray-500/30 ring-2 ring-gray-300', classInactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700' }
                                    ].map(({ color, label, classActive, classInactive }) => {
                                        const isActive = logs.find(l => l.id === editingShowConfig)?.priority_color === color;
                                        return (
                                            <button
                                                key={color}
                                                onClick={() => handleConfigSubmit(editingShowConfig, color, null)}
                                                className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${isActive ? classActive : classInactive}`}
                                            >
                                                {isActive && <svg className="w-4 h-4 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100 dark:border-slate-800">
                            <button onClick={() => { setEditingShowConfig(null); setTempConfigPromo(""); }} className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
                            <button onClick={() => { handleConfigSubmit(editingShowConfig, null, tempConfigPromo); setEditingShowConfig(null); }} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:-translate-y-0.5">Save Config</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Overlay */}
            {lightboxImage && (
                <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
                    <img src={lightboxImage} alt="Screenshot preview" />
                    <button
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/40 rounded-full p-2 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
        </div>
    );
}
