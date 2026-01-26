"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const router = useRouter();

    async function handleSignOut() {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    }

    return (
        <header className="bg-slate-900 shadow-lg border-b border-white/10 relative z-50">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 opacity-50"></div>
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between relative z-10">
                {/* Logo - Responsive */}
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
                        <div className="bg-indigo-500/10 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-indigo-500/20 backdrop-blur-sm group-hover:bg-indigo-500/20 transition-all flex-shrink-0">
                            <svg className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-base sm:text-xl font-bold text-white tracking-tight truncate">Show Check Log</h1>
                            <p className="text-[10px] sm:text-xs text-indigo-200/60 font-medium hidden xs:block">Monitoring Dashboard</p>
                        </div>
                    </Link>
                </div>

                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-4">
                    <Link href="/add" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                        Add Show
                    </Link>
                    <div className="h-6 w-px bg-white/10 mx-2"></div>
                    <div className="bg-white/5 rounded-full p-1 border border-white/10 hover:bg-white/10 transition-colors">
                        <NotificationBell />
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-4 py-2 rounded-lg border border-red-500/20 text-xs font-bold transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                    </button>
                </div>

                {/* Mobile Actions */}
                <div className="flex md:hidden items-center gap-2 sm:gap-3">
                    <div className="bg-white/5 rounded-full p-1 border border-white/10">
                        <NotificationBell />
                    </div>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="text-gray-400 hover:text-white p-2 active:scale-95 transition-transform"
                        aria-label="Toggle menu"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            {isMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile Menu - Improved */}
            {isMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30 animate-in fade-in duration-200"
                        onClick={() => setIsMenuOpen(false)}
                    ></div>

                    {/* Menu Panel */}
                    <div className="md:hidden absolute top-16 sm:top-20 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 shadow-2xl z-40 animate-in slide-in-from-top duration-200">
                        <nav className="p-4 space-y-2 max-w-lg mx-auto">
                            <Link
                                href="/add"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-blue-500/10 text-white hover:from-indigo-500/20 hover:to-blue-500/20 transition-all active:scale-95 border border-indigo-500/20"
                            >
                                <div className="bg-indigo-500/20 p-2 rounded-lg">
                                    <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <span className="font-bold text-base">Add New Show</span>
                                    <p className="text-xs text-indigo-200/60">Create a new show entry</p>
                                </div>
                            </Link>
                            <button
                                onClick={handleSignOut}
                                className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all active:scale-95 border border-red-500/20"
                            >
                                <div className="bg-red-500/20 p-2 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <span className="font-bold text-base">Sign Out</span>
                                    <p className="text-xs text-red-300/60">Log out of your account</p>
                                </div>
                            </button>
                        </nav>
                    </div>
                </>
            )}
        </header>
    );
}
