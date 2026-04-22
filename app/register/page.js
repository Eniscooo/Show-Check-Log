"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [position, setPosition] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [step, setStep] = useState(1); // 1: Register form, 2: Code verification
    const [code, setCode] = useState("");
    const [usernameError, setUsernameError] = useState(null);
    const [passwordErrors, setPasswordErrors] = useState([]);
    const router = useRouter();
    const canvasRef = useRef(null);

    // ── Canvas particle animation ───────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let animId;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener("resize", resize);

        const particles = Array.from({ length: 20 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.8 + 0.4,
            dx: (Math.random() - 0.5) * 0.3,
            dy: (Math.random() - 0.5) * 0.3,
            alpha: Math.random() * 0.4 + 0.1,
        }));

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(59,130,246,${p.alpha})`;
                ctx.fill();
                p.x += p.dx;
                p.y += p.dy;
                if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
            });
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(59,130,246,${0.12 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            animId = requestAnimationFrame(draw);
        }
        draw();
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", resize);
        };
    }, []);

    // Check if username is unique (debounced)
    useEffect(() => {
        if (!username || username.length < 3) {
            setUsernameError(null);
            return;
        }
        const timer = setTimeout(async () => {
            const { data } = await supabase
                .from("profiles")
                .select("id")
                .eq("username", username.toLowerCase())
                .maybeSingle();

            if (data) {
                setUsernameError("This username is already taken.");
            } else {
                setUsernameError(null);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [username]);

    // Password strength validation
    function validatePassword(pw) {
        const errors = [];
        if (pw.length < 8) errors.push("At least 8 characters");
        if (!/[A-Z]/.test(pw)) errors.push("One uppercase letter");
        if (!/[0-9]/.test(pw)) errors.push("One number");
        return errors;
    }

    useEffect(() => {
        if (password.length > 0) {
            setPasswordErrors(validatePassword(password));
        } else {
            setPasswordErrors([]);
        }
    }, [password]);

    async function handleRegister(e) {
        e.preventDefault();
        if (usernameError) return;

        const pwErrors = validatePassword(password);
        if (pwErrors.length > 0) {
            setPasswordErrors(pwErrors);
            setError("Please fix your password to meet the requirements.");
            return;
        }

        // Pre-check: is the email already in profiles?
        const emailLower = email.trim().toLowerCase();
        const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", emailLower)
            .maybeSingle();

        if (existingProfile) {
            setError("An account with this email already exists. Please log in instead.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: emailLower,
                password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        position: position,
                        username: username.toLowerCase(),
                    }
                },
            });

            if (authError) throw authError;

            if (authData?.user && authData.user.identities && authData.user.identities.length === 0) {
                setError("An account with this email already exists. Please log in instead.");
                setLoading(false);
                return;
            }

            if (!authData?.user) {
                setError("Something went wrong during registration. Please try again.");
                setLoading(false);
                return;
            }

            setStep(2);
            setSuccessMessage("Verification code sent! Check your email (including Spam).");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Step 2: Verify Registration OTP Code
    async function handleVerifyCode(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        if (!code || code.length < 6) {
            setError("Please enter the verification code.");
            setLoading(false);
            return;
        }

        try {
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                email: email.trim().toLowerCase(),
                token: code.trim(),
                type: 'signup'
            });

            if (verifyError) throw verifyError;

            if (!data?.session) {
                setError("Verification failed. The code may have expired. Please resend and try again.");
                setLoading(false);
                return;
            }

            // Force update profile just in case the Supabase trigger failed to set it correctly
            await supabase.from("profiles").update({
                username: username.toLowerCase(),
                first_name: firstName,
                last_name: lastName,
                position: position
            }).eq("id", data.session.user.id);

            // Verification successful — user is now logged in via the session created
            router.push('/');
        } catch (err) {
            setError("Invalid or expired code. Please double-check or resend a new one.");
        } finally {
            setLoading(false);
        }
    }

    // Resend OTP Code
    async function handleResendCode() {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email: email.trim().toLowerCase()
            });
            if (resendError) throw resendError;
            setSuccessMessage("A new verification code has been sent to your email!");
        } catch (err) {
            setError("Failed to resend: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    // Step 2 View: OTP Code Verification
    if (step === 2) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#060a14] relative font-sans px-4 py-8 overflow-hidden">
                <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-700/15 blur-[120px] animate-blob pointer-events-none" />

                <div className="w-full max-w-[440px] relative z-10">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black text-white mb-3">Verify Account</h2>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            We sent a verification code to <span className="text-blue-400 font-semibold">{email}</span>.
                            Enter it below to complete your registration.
                        </p>

                        <form onSubmit={handleVerifyCode} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-xs text-red-300 font-medium">{error}</p>
                                </div>
                            )}

                            {successMessage && !error && (
                                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 flex items-center justify-center gap-2 animate-fadeIn">
                                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-xs text-emerald-300 font-medium">{successMessage}</p>
                                </div>
                            )}

                            <div>
                                <input
                                    type="text"
                                    required
                                    maxLength={8}
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full max-w-[280px] mx-auto block px-4 py-4 text-center tracking-[0.3em] sm:tracking-[0.5em] text-2xl font-black bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white transition-all outline-none"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || code.length < 6}
                                className="w-full max-w-[280px] mx-auto py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-[0_0_25px_rgba(59,130,246,0.35)] hover:shadow-[0_0_35px_rgba(59,130,246,0.5)] active:scale-[0.98] mt-4"
                            >
                                {loading ? "Verifying..." : "Verify & Login"}
                            </button>
                        </form>

                        <div className="mt-6 flex flex-col items-center gap-3">
                            <span className="text-[10px] text-gray-500">Didn't get the code? (Check Spam folder!)</span>

                            <button
                                onClick={handleResendCode}
                                disabled={loading}
                                className="inline-flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Resend Code
                            </button>

                            <button onClick={() => { setStep(1); setCode(""); setError(null); setSuccessMessage(null); }} className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-white transition-colors mt-2">
                                ← Try another email
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-[#060a14] relative font-sans overflow-hidden">
            {/* Canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />

            {/* Animated blobs */}
            <div className="absolute top-[-15%] right-[5%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[140px] animate-blob pointer-events-none" />
            <div className="absolute top-[40%] left-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-[120px] animate-blob animation-delay-2000 pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[20%] w-[450px] h-[450px] rounded-full bg-blue-500/10 blur-[130px] animate-blob animation-delay-4000 pointer-events-none" />

            {/* Left side — Image panel (desktop) */}
            <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative z-10 items-center justify-center">
                <div className="w-full h-full flex items-center justify-center p-10 xl:p-16">
                    <div className="relative w-full max-w-[750px] xl:max-w-[1000px] h-[85vh] max-h-[700px] xl:max-h-[900px] rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(59,130,246,0.15)]">
                        <img src="/land.jpg" alt="Registration Visual" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-10 xl:p-14">
                            <h2 className="text-4xl xl:text-5xl font-black text-white mb-3 tracking-tight">Show Check Log</h2>
                            <p className="text-blue-200/80 text-lg xl:text-xl max-w-lg">Monitor your shows, manage your team checks, and stay ahead — all in one place.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right side — Register form */}
            <div className="w-full lg:w-[45%] xl:w-[40%] flex items-center justify-center relative z-10 px-4 py-8 min-h-screen lg:min-h-0">
                <div className="w-full max-w-[440px] xl:max-w-[500px]">

                    {/* Tab nav */}
                    <div className="flex gap-1 p-1 bg-white/5 rounded-2xl mb-6 backdrop-blur-sm border border-white/5">
                        <Link href="/login" className="btn-shiny flex-1 text-center py-2.5 text-sm font-bold rounded-xl text-gray-500 hover:text-gray-300 transition-colors">Login</Link>
                        <div className="btn-shiny flex-1 text-center py-2.5 text-sm font-bold rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">Register</div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-7">
                        <div className="mb-6">
                            <h1 className="text-2xl font-black text-white tracking-tight">Create Account</h1>
                            <p className="text-gray-400 mt-1 text-sm">Get started with Show Check Log</p>
                        </div>

                        <form onSubmit={handleRegister} className="space-y-3.5">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 flex items-start gap-2.5">
                                    <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-xs text-red-300 font-medium">{error}</p>
                                </div>
                            )}

                            {/* Name fields */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">First Name</label>
                                    <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3.5 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="John" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Last Name</label>
                                    <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3.5 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="Doe" />
                                </div>
                            </div>

                            {/* Position */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Position / Role</label>
                                <input type="text" required value={position} onChange={e => setPosition(e.target.value)} className="w-full px-3.5 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="e.g. Stage Manager, Lighting Tech" />
                            </div>

                            {/* Username */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Username</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">@</span>
                                    <input type="text" required value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))} className="w-full pl-8 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="username" minLength={3} />
                                    {username.length >= 3 && (
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                            {usernameError
                                                ? <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                : <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                            }
                                        </span>
                                    )}
                                </div>
                                {usernameError && <p className="text-[10px] text-red-400 font-medium mt-1">{usernameError}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3.5 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="name@example.com" />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                                <div className="relative">
                                    <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3.5 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all pr-10" placeholder="Min 8 chars, uppercase, number" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                        {showPassword
                                            ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        }
                                    </button>
                                </div>
                                {password.length > 0 && (
                                    <div className="mt-2 space-y-0.5">
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

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading || usernameError || passwordErrors.length > 0}
                                    className="btn-shiny w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-[0_0_25px_rgba(59,130,246,0.35)] hover:shadow-[0_0_35px_rgba(59,130,246,0.5)] active:scale-[0.98]"
                                >
                                    {loading ? "Creating Account..." : "Create Account"}
                                </button>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    );
}
