"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    async function handleResetRequest(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        if (!email || !email.includes("@")) {
            setError("Please enter a valid email address.");
            setLoading(false);
            return;
        }

        try {
            // 1. Check if the email exists in our records
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("email")
                .eq("email", email.trim().toLowerCase())
                .single();

            if (!profile || profileError) {
                // To prevent user enumeration, you might want to show a generic message,
                // but the USER SPECIFICALLY asked to only allow registered emails.
                setError("This email is not registered with us.");
                setLoading(false);
                return;
            }

            // 2. Request reset
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) throw error;

            setMessage("Password reset link sent! Check your email.");
        } catch (error) {
            console.error("Reset Request Error:", error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 z-0"></div>
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/30 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]"></div>

            <div className="relative z-10 w-full max-w-md p-8">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 transform transition-all hover:scale-[1.01]">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-600 shadow-lg mb-4">
                            <svg
                                className="w-8 h-8 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M15 7a2 2 0 012 2m-2-2a2 2 0 00-2 2m2-2V5a2 2 0 10-4 0v2m4 0h-4m2 0h2a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h2m0 0V5a2 2 0 114 0v2"
                                />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">
                            Reset Password
                        </h1>
                        <p className="text-indigo-200 mt-2 text-sm">
                            Enter your email to receive a reset link
                        </p>
                    </div>

                    <form onSubmit={handleResetRequest} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3">
                                <svg
                                    className="w-5 h-5 text-red-400 shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <p className="text-sm text-red-200">{error}</p>
                            </div>
                        )}

                        {message && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-3">
                                <svg
                                    className="w-5 h-5 text-green-400 shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <p className="text-sm text-green-200">{message}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-indigo-100 mb-1.5 ml-1">
                                Email Address
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg
                                        className="h-5 w-5 text-indigo-300 group-focus-within:text-indigo-400 transition-colors"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                                        />
                                    </svg>
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-indigo-300/50 transition-all outline-none"
                                    placeholder="admin@example.com"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 transform hover:translate-y-[-1px] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? "Sending..." : "Send Reset Link"}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-indigo-200">
                            Remember your password?{" "}
                            <Link href="/login" className="text-indigo-300 hover:text-white font-semibold underline">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
