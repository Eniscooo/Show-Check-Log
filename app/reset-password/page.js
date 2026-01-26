"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [sessionReady, setSessionReady] = useState(false);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;
        let subscription = null;

        async function handlePasswordRecovery() {
            try {
                // Check if there's a hash in the URL (recovery token)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const type = hashParams.get('type');

                console.log("Recovery params:", { hasAccessToken: !!accessToken, type });

                if (accessToken && type === 'recovery') {
                    // Manually set the session from the URL tokens
                    const { data, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || '',
                    });

                    if (sessionError) {
                        console.error("Session error:", sessionError);
                        if (isMounted) {
                            setError("Invalid or expired reset link. Please request a new password reset.");
                            setVerifying(false);
                        }
                        return;
                    }

                    if (data.session) {
                        console.log("Session established successfully");
                        if (isMounted) {
                            setSessionReady(true);
                            setVerifying(false);
                        }
                        return;
                    }
                }

                // Check for existing session
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    console.log("Existing session found");
                    if (isMounted) {
                        setSessionReady(true);
                        setVerifying(false);
                    }
                    return;
                }

                // Set up auth state listener as fallback
                const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
                    async (event, session) => {
                        console.log("Auth event:", event, "Session:", !!session);

                        if (!isMounted) return;

                        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                            setSessionReady(true);
                            setVerifying(false);
                        }
                    }
                );

                subscription = authSubscription;

                // Only show error if no tokens in URL and no session
                if (!accessToken && !session) {
                    if (isMounted) {
                        setError("Please use the password reset link from your email.");
                        setVerifying(false);
                    }
                }

            } catch (err) {
                console.error("Recovery error:", err);
                if (isMounted) {
                    setError("An error occurred while verifying your reset link. Please try again.");
                    setVerifying(false);
                }
            }
        }

        handlePasswordRecovery();

        return () => {
            isMounted = false;
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, []);

    async function handleResetPassword(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password.length < 6) {
            setError("Password must be at least 6 characters long");
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            // Double check validation: Do we have a session?
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // Last ditch effort: Try to recover from URL again
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (accessToken) {
                    const { data: refreshData, error: refreshError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || '',
                    });

                    if (refreshError || !refreshData.session) {
                        throw new Error("Your reset link has expired or is invalid. Please request a new one.");
                    }
                } else {
                    throw new Error("No active session. Please click the reset link in your email again.");
                }
            }

            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setMessage("Password successfully updated! Redirecting to login...");
            setTimeout(() => {
                router.push("/login");
            }, 2000);
        } catch (error) {
            console.error("Reset Password Error:", error);
            // Translate technical Supabase error to user friendly message
            if (error.message.includes("Auth session missing") || error.message.includes("session")) {
                setError("Your reset session has expired. Please go back to Forgot Password and request a new link.");
            } else {
                setError(error.message);
            }
        } finally {
            setLoading(false);
        }
    }

    if (verifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
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
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">
                            Set New Password
                        </h1>
                        <p className="text-indigo-200 mt-2 text-sm">
                            Enter your new secure password
                        </p>
                    </div>

                    <form onSubmit={handleResetPassword} className="space-y-6">
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
                                New Password
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white outline-none transition-all placeholder-indigo-300/50"
                                placeholder="••••••••"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-indigo-100 mb-1.5 ml-1">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white outline-none transition-all placeholder-indigo-300/50"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !password}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 transform hover:translate-y-[-1px] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? "Updating..." : "Reset Password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
