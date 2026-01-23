"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Link from "next/link";

export default function  AddEntry() {
    const router = useRouter();
    const [checkStartDate, setCheckStartDate] = useState("");
    const [checkEndDate, setCheckEndDate] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [user, setUser] = useState(null);
    const [userName, setUserName] = useState("");

    useEffect(() => {
        async function getUser() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                // Get user's name from metadata
                const firstName = user.user_metadata?.first_name || "";
                const lastName = user.user_metadata?.last_name || "";
                const username = user.user_metadata?.username || "";
                // Use full name if available, otherwise username
                const displayName = (firstName && lastName) 
                    ? `${firstName} ${lastName}` 
                    : username || user.email?.split('@')[0] || "User";
                setUserName(displayName);
            }
        }
        getUser();
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);

        if (!user) {
            alert("You must be logged in to add a show");
            setSubmitting(false);
            return;
        }

        // Build the insert object using the correct column names from your schema
        const insertData = {
            show_name: userName,
            show_url: null,
            status: false,
            priority_color: 'none',
            user_id: user.id,
            // Use the existing column names: check_starting and checked_through
            check_starting: checkStartDate || null,
            checked_through: checkEndDate || null
        };

        const { error } = await supabase.from("show_logs").insert([insertData]);

        if (error) {
            console.error("Error inserting data:", error);
            alert(`Error: ${error.message || "Unknown error"}`);
            setSubmitting(false);
            return;
        }

        router.push("/");
    }

    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
                <div className="mb-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Add New Show</h1>
                        <p className="mt-2 text-sm text-gray-500">
                            Create a show to start tracking checks.
                        </p>
                    </div>
                    <Link href="/">
                        <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 hover:shadow-lg transition-all shadow-md">
                            ← Back to Dashboard
                        </button>
                    </Link>
                </div>

                <div className="bg-white rounded-xl shadow-lg ring-1 ring-gray-900/5 overflow-hidden">
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* User Info Display */}
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-gray-600 mb-1">Show will be created for:</p>
                            <p className="text-lg font-semibold text-indigo-900">{userName || "Loading..."}</p>
                        </div>

                        {/* Check Start Date */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">
                                Check Start Date
                            </label>
                            <input
                                type="date"
                                className="block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                                value={checkStartDate}
                                onChange={e => setCheckStartDate(e.target.value)}
                            />
                        </div>

                        {/* Check End Date */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">
                                Check End Date
                            </label>
                            <input
                                type="date"
                                className="block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                                value={checkEndDate}
                                onChange={e => setCheckEndDate(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                            <Link href="/">
                                <button type="button" className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                                    Cancel
                                </button>
                            </Link>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md disabled:opacity-50"
                            >
                                {submitting ? "Creating..." : "Create Show"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}
