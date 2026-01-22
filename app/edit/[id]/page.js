"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

export default function EditEntry() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    // Show details
    const [showName, setShowName] = useState("");
    const [showUrl, setShowUrl] = useState("");
    const [checkStarting, setCheckStarting] = useState("");
    const [checkedThrough, setCheckedThrough] = useState("");
    const [dateChecked, setDateChecked] = useState("");
    const [timeChecked, setTimeChecked] = useState("");
    const [status, setStatus] = useState(false);
    const [originalStatus, setOriginalStatus] = useState(false);
    const [loading, setLoading] = useState(true);

    // Assigned users
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [editingUser, setEditingUser] = useState(null);

    useEffect(() => {
        fetchEntry();
        fetchAssignedUsers();
    }, []);

    async function fetchEntry() {
        const { data, error } = await supabase
            .from("show_logs")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            alert("Error loading entry");
            return;
        }

        setShowName(data.show_name || "");
        setShowUrl(data.show_url || "");
        setCheckStarting(data.check_starting || "");
        setCheckedThrough(data.checked_through || "");
        setDateChecked(data.date_checked || "");
        setTimeChecked(data.time_checked || "");
        setStatus(data.status || false);
        setOriginalStatus(data.status || false);
        setLoading(false);
    }

    async function fetchAssignedUsers() {
        const { data, error } = await supabase
            .from("show_users")
            .select("*")
            .eq("show_id", id)
            .order("created_at", { ascending: true });

        if (!error && data) {
            setAssignedUsers(data);
        }
    }

    async function handleUpdate(e) {
        e.preventDefault();

        const primaryDate = dateChecked || new Date().toISOString().split('T')[0];

        // Prepare update data
        const updateData = {
            show_name: showName,
            show_url: showUrl || null,
            check_starting: checkStarting,
            checked_through: checkedThrough,
            date_checked: dateChecked || null,
            time_checked: timeChecked || null,
            show_date: primaryDate,
            status: status
        };

        // If status changed from false to true, record the timestamp
        if (status && !originalStatus) {
            updateData.status_updated_at = new Date().toISOString();
        }
        // If status changed from true to false, clear the timestamp
        if (!status && originalStatus) {
            updateData.status_updated_at = null;
        }

        const { error } = await supabase
            .from("show_logs")
            .update(updateData)
            .eq("id", id);

        if (error) {
            console.error("Error updating:", error);
            alert(`Error: ${error.message || "Failed to update"}`);
            return;
        }

        router.push("/");
    }

    async function handleDeleteUser(userId) {
        if (!confirm("Remove this user from the show?")) return;

        await supabase.from("show_users").delete().eq("id", userId);
        setAssignedUsers(assignedUsers.filter(u => u.id !== userId));
    }

    async function handleUpdateUserStatus(userId, newStatus) {
        const updateData = {
            status: newStatus
        };

        // If marking as checked, record timestamp
        if (newStatus) {
            updateData.checked_at = new Date().toISOString();
        }

        await supabase
            .from("show_users")
            .update(updateData)
            .eq("id", userId);

        setAssignedUsers(assignedUsers.map(u =>
            u.id === userId ? { ...u, status: newStatus, checked_at: newStatus ? new Date().toISOString() : null } : u
        ));
    }

    if (loading) return (
        <div className="flex justify-center items-center h-screen bg-gray-50">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-700"></div>
                <p className="text-gray-500 font-medium">Loading entry details...</p>
            </div>
        </div>
    );

    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 inline-block">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Edit Show</h1>
                    <p className="mt-2 text-sm text-gray-600">Update show details and manage assigned users.</p>
                </div>

                {/* Show Details Form */}
                <div className="bg-white rounded-xl shadow-lg ring-1 ring-gray-900/5 overflow-hidden mb-8">
                    <form onSubmit={handleUpdate} className="p-8 space-y-6">
                        <h2 className="text-lg font-semibold text-slate-900 border-b pb-3">Show Details</h2>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            {/* Show Name */}
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-semibold leading-6 text-slate-900">
                                    Show Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                                    value={showName}
                                    onChange={e => setShowName(e.target.value)}
                                />
                            </div>

                            {/* Show URL */}
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-semibold leading-6 text-slate-900">
                                    Show URL
                                </label>
                                <input
                                    type="url"
                                    className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                                    placeholder="https://..."
                                    value={showUrl}
                                    onChange={e => setShowUrl(e.target.value)}
                                />
                            </div>

                            {/* Check Date Range */}
                            <div>
                                <label className="block text-sm font-semibold leading-6 text-slate-900">
                                    Check Starting
                                </label>
                                <input
                                    type="date"
                                    className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                                    value={checkStarting}
                                    onChange={e => setCheckStarting(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold leading-6 text-slate-900">
                                    Check Through
                                </label>
                                <input
                                    type="date"
                                    className="mt-2 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                                    value={checkedThrough}
                                    onChange={e => setCheckedThrough(e.target.value)}
                                />
                            </div>

                            {/* Show Status */}
                            <div className="sm:col-span-2">
                                <div className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <input
                                        id="status"
                                        type="checkbox"
                                        checked={status}
                                        onChange={e => setStatus(e.target.checked)}
                                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                    />
                                    <div className="ml-3">
                                        <label htmlFor="status" className="font-medium text-slate-900">Mark Show as Checked</label>
                                        <p className="text-sm text-gray-500">This affects the overall show status. Individual users can update their own status below.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-4 pt-6 border-t">
                            <Link href="/">
                                <button type="button" className="rounded-md px-3.5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-gray-100 transition-colors">
                                    Cancel
                                </button>
                            </Link>
                            <button
                                type="submit"
                                className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>

                {/* Assigned Users Section */}
                <div className="bg-white rounded-xl shadow-lg ring-1 ring-gray-900/5 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-slate-900">Assigned Users ({assignedUsers.length})</h2>
                        <p className="text-sm text-gray-500 mt-1">Users taking shifts to check this show</p>
                    </div>

                    {assignedUsers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <p>No users assigned yet. Users can join from the dashboard.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-200">
                            {assignedUsers.map(user => (
                                <li key={user.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${user.status ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <div>
                                                <p className="font-medium text-slate-900">{user.user_name}</p>
                                                {user.user_email && (
                                                    <p className="text-sm text-gray-500">{user.user_email}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleUpdateUserStatus(user.id, !user.status)}
                                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${user.status
                                                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                                                    }`}
                                            >
                                                {user.status ? 'Checked' : 'Pending'} - Click to Toggle
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                    {user.checked_at && (
                                        <p className="text-xs text-gray-400 mt-1 ml-6">
                                            Last checked: {new Date(user.checked_at).toLocaleString()}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </main>
    );
}
