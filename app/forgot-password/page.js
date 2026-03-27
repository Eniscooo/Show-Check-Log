"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
    const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: New Password
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const router = useRouter();

    // Step 1: Request OTP Code
    async function handleRequestCode(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!email || !email.includes("@")) {
            setError("Please enter a valid email address.");
            setLoading(false);
            return;
        }

        try {
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("email")
                .eq("email", email.trim().toLowerCase())
                .single();

            if (!profile || profileError) {
                setError("This email is not registered with us.");
                setLoading(false);
                return;
            }

            // Send 6-digit OTP code instead of a magic link URL
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

            if (error) throw error;
            setStep(2); // Move to code verification step
            setSuccessMessage("Code sent! Check your email.");
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }

    // Step 2: Verify OTP Code
    async function handleVerifyCode(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!code || code.length < 6) {
            setError("Please enter the recovery code sent to your email.");
            setLoading(false);
            return;
        }

        try {
            // Verify the OTP. If successful, it automatically logs the user in (creates a session)
            const { error } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: code.trim(),
                type: 'recovery'
            });

            if (error) throw error;
            setStep(3); // Move to password reset step
        } catch (error) {
            setError("Invalid or expired code. Please double-check the code from your email.");
        } finally {
            setLoading(false);
        }
    }

    // Resend Recovery Code
    async function handleResendCode(e) {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const { error: resendError } = await supabase.auth.resetPasswordForEmail(email.trim());
            if (resendError) throw resendError;
            setSuccessMessage("A new recovery code has been sent!");
        } catch (err) {
            setError("Failed to resend: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    // Step 3: Set New Password
    async function handleSetNewPassword(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            setError("Password must be 8+ characters, with an uppercase letter and a number.");
            setLoading(false);
            return;
        }

        try {
            // We have a session from step 2, so we can just update the user
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            // Password reset successful!
            router.push("/login");
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#060a14] relative overflow-hidden px-4">
            {/* Background Blobs */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[140px] animate-blob pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-[120px] animate-blob animation-delay-2000 pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-7">
                    <div className="text-center mb-8">
                        {step === 1 && (
                            <>
                                <h1 className="text-2xl font-black text-white tracking-tight">Reset Password</h1>
                                <p className="text-gray-400 mt-2 text-sm">Enter your email to receive a recovery code</p>
                            </>
                        )}
                        {step === 2 && (
                            <>
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 mb-4">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                </div>
                                <h1 className="text-2xl font-black text-white tracking-tight">Enter Code</h1>
                                <p className="text-gray-400 mt-2 text-sm">We sent a recovery code to <br /><span className="text-blue-400 font-semibold">{email}</span></p>
                            </>
                        )}
                        {step === 3 && (
                            <>
                                <h1 className="text-2xl font-black text-white tracking-tight">Secure Account</h1>
                                <p className="text-gray-400 mt-2 text-sm">Code verified! Enter your new password below.</p>
                            </>
                        )}
                    </div>

                    <form onSubmit={step === 1 ? handleRequestCode : step === 2 ? handleVerifyCode : handleSetNewPassword} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3.5 flex items-start gap-3">
                                <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-xs text-red-300">{error}</p>
                            </div>
                        )}

                        {successMessage && !error && (
                            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 flex items-center justify-center gap-2 animate-fadeIn">
                                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-xs text-emerald-300 font-medium">{successMessage}</p>
                            </div>
                        )}

                        {step === 1 && (
                            <div>
                                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-500 text-sm transition-all outline-none"
                                    placeholder="name@example.com"
                                />
                            </div>
                        )}

                        {step === 2 && (
                            <div>
                                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Code</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={8}
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} // Numbers only
                                    className="w-full px-4 py-4 text-center tracking-[0.3em] sm:tracking-[0.5em] text-2xl font-black bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white transition-all outline-none"
                                    placeholder="••••••"
                                />
                            </div>
                        )}

                        {step === 3 && (
                            <div>
                                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-500 text-sm transition-all outline-none"
                                    placeholder="Min 8 chars, uppercase, number"
                                />
                                {password.length > 0 && (
                                    <div className="mt-3 space-y-1">
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
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading || (step === 3 && password.length < 8)}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-[0_0_25px_rgba(59,130,246,0.35)] active:scale-[0.98]"
                            >
                                {loading ? "Processing..." : step === 1 ? "Send Code" : step === 2 ? "Verify Code" : "Update Password"}
                            </button>
                        </div>
                    </form>

                    {step === 1 ? (
                        <div className="mt-5 text-center">
                            <Link href="/login" className="text-sm text-gray-500 hover:text-blue-400 font-medium transition-colors">
                                ← Back to Login
                            </Link>
                        </div>
                    ) : step === 2 ? (
                        <div className="mt-6 flex flex-col items-center gap-3">
                            <button
                                onClick={handleResendCode}
                                disabled={loading}
                                className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Resend Recovery Code
                            </button>

                            <button onClick={() => setStep(1)} className="text-xs font-bold text-gray-500 hover:text-white transition-colors mt-2">
                                ← Try another email
                            </button>
                        </div>
                    ) : (
                        <div className="mt-5 text-center">
                            <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-blue-400 font-medium transition-colors">
                                ← Back to Start
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Hint message explaining Supabase OTP template */}
            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                <p className="text-[10px] text-gray-600 max-w-sm mx-auto">
                    Note: Ensure your Supabase email templates include <code>{"{{ .Token }}"}</code> to send the verification code.
                </p>
            </div>
        </div>
    );
}
