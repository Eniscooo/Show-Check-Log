"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import toast from "react-hot-toast";

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
            toast.error("You must be logged in to add a show");
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
            toast.error(`Error: ${showError.message}`);
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

        toast.success("Show created successfully!");
        router.push("/");
        router.refresh();
    }

    return (
        <main className="min-h-screen bg-[var(--background)] transition-colors duration-300 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center relative overflow-hidden">
            {/* Background design elements */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none"></div>

            <div className="max-w-md w-full mx-auto relative z-10">
                <div className="mb-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Add New Show</h1>

                    </div>
                    <Link href="/">
                        <button className="px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition-all flex items-center gap-2 group">
                            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            Back
                        </button>
                    </Link>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-indigo-500/5 ring-1 ring-gray-900/5 dark:ring-white/10 overflow-hidden transform transition-all">
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {/* Show Name */}
                        <div>
                            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2 ml-1">
                                Show Name *
                            </label>
                            <input
                                type="text"
                                required
                                className="block w-full rounded-2xl border-0 py-3.5 px-4 text-slate-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-200 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition-all"
                                placeholder="e.g. Great Gatsby"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        {/* Show URL */}
                        <div>
                            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2 ml-1">
                                Show URL <span className="text-xs text-gray-400 font-medium">(Optional)</span>
                            </label>
                            <input
                                type="url"
                                className="block w-full rounded-2xl border-0 py-3.5 px-4 text-slate-900 dark:text-white dark:bg-slate-800 shadow-sm ring-1 ring-inset ring-gray-200 dark:ring-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm transition-all"
                                placeholder="https://..."
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-slate-800/80">
                            <Link href="/">
                                <button type="button" className="px-5 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                    Cancel
                                </button>
                            </Link>
                            <button
                                type="submit"
                                disabled={submitting || !name.trim()}
                                className="btn-shiny flex-1 max-w-[200px] flex justify-center items-center gap-2 px-5 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20 hover:shadow-lg transition-all active:scale-95"
                            >
                                {submitting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Creating...
                                    </>
                                ) : "Create New Show"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}
