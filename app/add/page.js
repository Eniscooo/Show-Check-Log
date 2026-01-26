"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Link from "next/link";

export default function AddEntry() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            alert("You must be logged in to add a show");
            setSubmitting(false);
            return;
        }

        // 1. Create the Show
        const { data: showData, error: showError } = await supabase
            .from("shows")
            .insert([{
                name: name,
                url: url || null,
                notes: "" // Initialize empty notes
            }])
            .select()
            .single();

        if (showError) {
            console.error("Error creating show:", showError);
            alert(`Error: ${showError.message}`);
            setSubmitting(false);
            return;
        }

        // 2. Auto-join the creator to the show
        if (showData) {
            const { error: joinError } = await supabase
                .from("show_participants")
                .insert([{
                    show_id: showData.id,
                    user_id: user.id,
                    user_name: user.user_metadata?.first_name
                        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
                        : (user.email?.split('@')[0] || "User"),
                    status: false
                }]);

            if (joinError) {
                console.error("Error joining show:", joinError);
                // Don't block navigation, just warn
            }
        }

        router.push("/");
        router.refresh();
    }

    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
                <div className="mb-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Add New Show</h1>
                        <p className="mt-2 text-sm text-gray-500">
                            Create a show for the team to track.
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
                        {/* Show Name */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">
                                Show Name *
                            </label>
                            <input
                                type="text"
                                required
                                className="block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                                placeholder="e.g. Morning News"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        {/* Show URL */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">
                                Show URL (Optional)
                            </label>
                            <input
                                type="url"
                                className="block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                                placeholder="https://..."
                                value={url}
                                onChange={e => setUrl(e.target.value)}
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
                                disabled={submitting || !name.trim()}
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
