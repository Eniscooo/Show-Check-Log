"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
        let timeoutId = null;

        async function handlePasswordRecovery() {
            try {
                // 1. Try to get tokens from URL hash
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const type = hashParams.get('type');

                if (accessToken && type === 'recovery') {
                    const { data, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || '',
                    });

                    if (sessionError) {
                        if (isMounted) {
                            setError("Invalid or expired reset link. Please request a new one.");
                            setVerifying(false);
                        }
                        return;
                    }

                    if (data.session) {
                        if (isMounted) {
                            setSessionReady(true);
                            setVerifying(false);
                        }
                        return;
                    }
                }

                // 2. Check for existing session
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    if (isMounted) {
                        setSessionReady(true);
                        setVerifying(false);
                    }
                    return;
                }

                // 3. Listen for auth state changes (Supabase may process the token async)
                const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
                    async (event, session) => {
                        if (!isMounted) return;
                        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                            setSessionReady(true);
                            setVerifying(false);
                        }
                    }
                );
                subscription = authSubscription;

                // 4. Wait 5 seconds before showing error — give Supabase time to process
                timeoutId = setTimeout(() => {
                    if (isMounted && !sessionReady) {
                        setError("No valid reset session found. Please click the reset link in your email, or request a new one.");
                        setVerifying(false);
                    }
                }, 5000);

            } catch (err) {
                if (isMounted) {
                    setError("An error occurred. Please try again.");
                    setVerifying(false);
                }
            }
        }

        handlePasswordRecovery();

        return () => {
            isMounted = false;
            if (subscription) subscription.unsubscribe();
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    // Password validation
    function validatePassword(pw) {
        const errors = [];
        if (pw.length < 8) errors.push("At least 8 characters");
        if (!/[A-Z]/.test(pw)) errors.push("One uppercase letter");
        if (!/[0-9]/.test(pw)) errors.push("One number");
        return errors;
    }

    async function handleResetPassword(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const pwErrors = validatePassword(password);
        if (pwErrors.length > 0) {
            setError("Password must have: " + pwErrors.join(", "));
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (accessToken) {
                    const { data: refreshData, error: refreshError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || '',
                    });
                    if (refreshError || !refreshData.session) {
                        throw new Error("Your reset link has expired. Please request a new one.");
                    }
                } else {
                    throw new Error("No active session. Please click the reset link in your email again.");
                }
            }

            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            setMessage("Password updated! Redirecting to login...");
            setTimeout(() => router.push("/login"), 2000);
        } catch (error) {
            if (error.message.includes("session")) {
                setError("Your reset session has expired. Please request a new link.");
            } else {
                setError(error.message);
            }
        } finally {
            setLoading(false);
        }
    }

    if (verifying) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#060a14]">
                <svg className="animate-spin h-8 w-8 text-blue-500 mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                <p className="text-gray-400 text-sm">Verifying your reset link...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#060a14] relative overflow-hidden px-4">
            {/* Background */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[140px] animate-blob pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-[120px] animate-blob animation-delay-2000 pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-7">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-black text-white tracking-tight">Set New Password</h1>
                        <p className="text-gray-400 mt-2 text-sm">Enter your new secure password</p>
                    </div>

                    <form onSubmit={handleResetPassword} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3.5 flex items-start gap-3">
                                <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-xs text-red-300">{error}</p>
                            </div>
                        )}

                        {message && (
                            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3.5 flex items-center gap-3">
                                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-xs text-emerald-300">{message}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">New Password</label>
                            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white outline-none transition-all placeholder-gray-600 text-sm"
                                placeholder="••••••••" />
                            {password.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {[
                                        { label: "8+ characters", met: password.length >= 8 },
                                        { label: "Uppercase letter", met: /[A-Z]/.test(password) },
                                        { label: "Number", met: /[0-9]/.test(password) },
                                    ].map((rule, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                            {rule.met
                                                ? <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                : <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                            }
                                            <span className={`text-[10px] font-medium ${rule.met ? 'text-emerald-400' : 'text-gray-500'}`}>{rule.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Confirm Password</label>
                            <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white outline-none transition-all placeholder-gray-600 text-sm"
                                placeholder="••••••••" />
                            {confirmPassword.length > 0 && password !== confirmPassword && (
                                <p className="text-xs text-red-400 mt-1.5 font-medium">Passwords don't match</p>
                            )}
                        </div>

                        <div className="pt-1">
                            <button type="submit" disabled={loading || !password}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_25px_rgba(59,130,246,0.35)] transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] text-sm">
                                {loading ? "Updating..." : "Reset Password"}
                            </button>
                        </div>
                    </form>

                    <div className="mt-5 text-center">
                        <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-blue-400 font-medium transition-colors">Need a new reset link?</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
