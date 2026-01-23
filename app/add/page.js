"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Link from "next/link";

export default function  AddEntry() {
    const router = useRouter();
    const [showName, setShowName] = useState("");
    const [showUrl, setShowUrl] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);

        const { error } = await supabase.from("show_logs").insert([
            {
                show_name: showName,
                show_url: showUrl || null,
                status: false,
                priority_color: 'none'
            }
        ]);

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

                        {/* Show Name */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">
                                Show Name *
                            </label>
                            <input
                                type="text"
                                required
                                className="block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm capitalize"
                                placeholder="e.g. Blue Note Jazz Club"
                                value={showName}
                                onChange={e => setShowName(e.target.value)}
                            />
                        </div>

                        {/* Show URL */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">
                                Show URL *
                            </label>
                            <input
                                type="url"
                                required
                                className="block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                                placeholder="https://example.com"
                                value={showUrl}
                                onChange={e => setShowUrl(e.target.value)}
                            />
                            <p className="mt-1 text-xs text-gray-500">Show name will be clickable and open this URL</p>
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
