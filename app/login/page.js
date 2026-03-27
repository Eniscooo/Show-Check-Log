"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();
    const canvasRef = useRef(null);

    // ── Canvas particle animation ─────────────────────────────────────────
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

        const particles = Array.from({ length: 80 }, () => ({
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

    async function handleLogin(e) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            let loginEmail = identifier;
            if (!identifier.includes("@")) {
                const cleaned = identifier.startsWith("@") ? identifier.slice(1) : identifier;
                const { data: profile, error: profileErr } = await supabase
                    .from("profiles")
                    .select("email")
                    .eq("username", cleaned.toLowerCase())
                    .single();
                if (profileErr || !profile) throw new Error("Username not found. Please check and try again.");
                loginEmail = profile.email;
            }
            const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
            if (error) throw error;

            // Set dark mode as default on login
            if (!localStorage.getItem("theme")) {
                localStorage.setItem("theme", "dark");
                document.documentElement.classList.add("dark");
            }

            router.push("/");
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex bg-[#060a14] relative font-sans overflow-hidden">
            {/* Animated canvas background */}
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />

            {/* Gradient blobs — animated */}
            <div className="absolute top-[-15%] left-[10%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[140px] animate-blob pointer-events-none" />
            <div className="absolute top-[30%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-[120px] animate-blob animation-delay-2000 pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[30%] w-[450px] h-[450px] rounded-full bg-blue-500/10 blur-[130px] animate-blob animation-delay-4000 pointer-events-none" />

            {/* Left side — Image panel */}
            <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative z-10 items-center justify-center">
                <div className="w-full h-full flex items-center justify-center p-10 xl:p-16">
                    <div className="relative w-full max-w-[750px] xl:max-w-[1000px] h-[85vh] max-h-[700px] xl:max-h-[900px] rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(59,130,246,0.15)]">
                        <img
                            src="/land.jpg"
                            alt="Show Check Dashboard"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.classList.add('bg-gradient-to-br', 'from-blue-900/40', 'via-slate-900/60', 'to-indigo-900/40');
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-10 xl:p-14">
                            <h2 className="text-4xl xl:text-5xl font-black text-white mb-3 tracking-tight">Show Check Log</h2>
                            <p className="text-blue-200/80 text-lg xl:text-xl max-w-lg">Monitor your shows, manage your team checks, and stay ahead — all in one place.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right side — Login form */}
            <div className="w-full lg:w-[45%] xl:w-[40%] flex items-center justify-center px-4 py-8 relative z-10 min-h-screen lg:min-h-0">
                <div className="w-full max-w-[420px] xl:max-w-[480px]">
                    {/* Header — no logo icon */}
                    <div className="text-center mb-8">
                        <h1 className="text-[28px] font-black text-white tracking-tight">Welcome Back</h1>
                        <p className="text-gray-400 text-sm mt-1.5">Sign in to your Show Check account.</p>
                    </div>

                    {/* Tab bar */}
                    <div className="w-full bg-white/5 backdrop-blur-sm rounded-2xl p-1.5 flex items-center mb-6 border border-white/8">
                        <div className="w-1/2 py-2.5 text-sm font-bold text-center text-white bg-blue-600 rounded-xl shadow cursor-default">Login</div>
                        <Link href="/register" className="w-1/2 py-2.5 text-sm font-bold text-center text-gray-400 hover:text-white transition-colors rounded-xl">Register</Link>
                    </div>

                    {/* Card */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                        <form onSubmit={handleLogin} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3.5 flex items-center gap-3">
                                    <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <p className="text-xs text-red-300">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Email or Username</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-600 text-sm transition-all outline-none"
                                        placeholder="name@example.com or @username"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">Password</label>
                                    <Link href="/forgot-password" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">Forgot?</Link>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-11 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-600 text-sm transition-all outline-none"
                                        placeholder="••••••••"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300 transition-colors">
                                        {showPassword
                                            ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                            : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        }
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-shiny w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-[0_0_25px_rgba(59,130,246,0.35)] hover:shadow-[0_0_35px_rgba(59,130,246,0.5)] active:scale-[0.98]"
                                >
                                    {loading ? (
                                        <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Signing in...</>
                                    ) : "Sign In →"}
                                </button>
                            </div>
                        </form>
                    </div>


                </div>
            </div>
        </div>
    );
}
