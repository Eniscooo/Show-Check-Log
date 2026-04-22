"use client";

import AppShell from "../components/AppShell";
import Link from "next/link";
import { useState } from "react";

const sections = [
    {
        id: "getting-started",
        icon: "🚀",
        title: "Getting Started",
        color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        steps: [
            { title: "Create Your Account", desc: "Head to the registration page and sign up with your email, username, and password. You'll receive a confirmation email." },
            { title: "Log In", desc: "Use your email or username to sign in. Forgot your password? Use the 'Forgot?' link on the login page to reset it via email." },
            { title: "Explore the Dashboard", desc: "Once logged in, you'll see the main dashboard with stats, announcements, and your show table." }
        ]
    },
    {
        id: "dashboard",
        icon: "📊",
        title: "Dashboard Overview",
        color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
        steps: [
            { title: "Stats Bar", desc: "At the top, you'll see key metrics — total shows, participants, checked counts, and pending counts updated in real-time." },
            { title: "Announcements", desc: "Important team updates appear here. Anyone can post announcements with priority levels (Urgent, High, Normal, Low)." },
            { title: "Show Table", desc: "The main table lists all shows. Use the search bar to find shows quickly, and the sort/filter controls to organize them." },
            { title: "Activity Log", desc: "At the bottom, a running log of all team actions — who joined, checked, or updated shows." }
        ]
    },
    {
        id: "shows",
        icon: "🎭",
        title: "Managing Shows",
        color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        steps: [
            { title: "Add a Show", desc: "Click 'Add New Show' and enter the show name and URL. You'll automatically be added as a participant." },
            { title: "Join a Show", desc: "Click the 'Join' button on any show you're not part of. Your name and email are auto-filled from your profile." },
            { title: "Set Priority", desc: "Click the edit (pencil) icon on a show to set its priority: High (red glow), Medium (orange), Low (yellow), or None." },
            { title: "Add Notes", desc: "Click the notes area on any show to add or edit notes. Notes are shared and visible to all team members." },
            { title: "Upload Screenshots", desc: "Expand a show and click 'Upload' in the screenshots section to attach images. Click any thumbnail for a full-size view." },
            { title: "Search & Sort", desc: "Use the search bar to filter shows by name or notes. Sort by name, priority, date, or number of users. Filter by priority level." }
        ]
    },
    {
        id: "checking",
        icon: "✅",
        title: "Check Status",
        color: "bg-green-500/10 text-green-500 border-green-500/20",
        steps: [
            { title: "Mark as Checked", desc: "Expand a show and click the 'Pending' button next to your name to mark it as 'Checked'. You can only change your own status." },
            { title: "Auto-Reset", desc: "The system periodically resets checked statuses to ensure ongoing monitoring. You'll see the timestamp of your last check." },
            { title: "Date Ranges", desc: "When joining a show, set your check start and end dates. Edit these anytime by clicking 'Edit Date'." }
        ]
    },
    {
        id: "announcements",
        icon: "📢",
        title: "Announcements",
        color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        steps: [
            { title: "Post an Announcement", desc: "Click the 'Post' button in the Announcements section. Add a title, content, and select a priority level." },
            { title: "Priority Levels", desc: "🔴 Urgent — critical, gets a pulsing glow. 🟠 High — important. 🔵 Normal — general updates. ⚪ Low — minor info." },
            { title: "Edit & Delete", desc: "You can edit or delete your own announcements. Admins can delete any announcement and pin important ones to the top." }
        ]
    },
    {
        id: "alerts",
        icon: "🔔",
        title: "Notifications & Alerts",
        color: "bg-red-500/10 text-red-500 border-red-500/20",
        steps: [
            { title: "Bell Notifications", desc: "The bell icon in the navbar shows alerts when shows have all users pending for more than 24 hours." },
            { title: "Email Alerts", desc: "The system can send automated email reminders when shows are overdue. These are triggered automatically." },
            { title: "Active Users", desc: "See who's online in real-time via the status indicator in the navbar. Click it for a full list of recently active users." }
        ]
    },
    {
        id: "messenger",
        icon: "💬",
        title: "Team Messenger",
        color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        steps: [
            { title: "Direct Messages & Channels", desc: "Start a private 1-on-1 chat by clicking the ✉ icon, or create a team channel with the + icon." },
            { title: "Sharing Media", desc: "Click the '+' icon next to the chat box to upload screenshots and images. Click any image in chat to view it fullscreen and download." },
            { title: "Reactions", desc: "Hover over a message to reveal the 😊 icon and add quick reactions to any message." },
            { title: "Mute & Notifications", desc: "Click the info icon (top right in a chat) to mute notifications for that specific group or channel." }
        ]
    },
    {
        id: "shift-log",
        icon: "⏱",
        title: "Shift Log & Invoicing",
        color: "bg-teal-500/10 text-teal-500 border-teal-500/20",
        steps: [
            { title: "Clocking In/Out", desc: "Log your daily start and end times in the Shift Log tab to keep track of your hours." },
            { title: "Breaks", desc: "Use the 'Start Break' button to pause your timer. Break time is automatically deducted from your total hours." },
            { title: "Export Weekly Invoice", desc: "Click 'Download' on the Weekly Report section to generate a ready-to-use CSV invoice tracking your total logged hours and breaks." }
        ]
    },
    {
        id: "promo-codes",
        icon: "🎫",
        title: "Promo Codes",
        color: "bg-pink-500/10 text-pink-500 border-pink-500/20",
        steps: [
            { title: "Manage Codes", desc: "Click your profile picture top right, and select 'Promo Codes' to open the manager." },
            { title: "Add & Delete", desc: "Select a show from the dropdown to attach a new promo code. You can also view, copy, and delete active codes." },
            { title: "Search", desc: "Use the search bar in the promo codes modal to quickly find tracking codes for any specific show." }
        ]
    }
];

export default function GuidePage() {
    const [activeSection, setActiveSection] = useState(null);

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-indigo-500/10 px-4 py-1.5 rounded-full text-sm font-bold text-indigo-500 border border-indigo-500/20 mb-4">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        User Guide
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">How to Use Show Check Log</h1>
                    <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        A step-by-step guide to get the most out of the platform. Click any section for details.
                    </p>
                </div>

                {/* Quick Nav */}
                <div className="flex flex-wrap gap-2 justify-center mb-10">
                    {sections.map(s => (
                        <a key={s.id} href={`#${s.id}`} className="text-xs font-bold px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:border-indigo-500 hover:text-indigo-500 transition-all">
                            {s.icon} {s.title}
                        </a>
                    ))}
                </div>

                {/* Sections */}
                <div className="space-y-6">
                    {sections.map((s, sIdx) => (
                        <div key={s.id} id={s.id} className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-transparent overflow-hidden shadow-sm animate-fadeIn">
                            <button
                                onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                                className="w-full px-6 py-5 flex items-center gap-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <span className={`text-2xl w-12 h-12 rounded-xl flex items-center justify-center border ${s.color}`}>{s.icon}</span>
                                <div className="flex-1">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{s.title}</h2>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">{s.steps.length} steps</p>
                                </div>
                                <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${activeSection === s.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {activeSection === s.id && (
                                <div className="px-6 pb-6 border-t border-gray-100 dark:border-slate-800 pt-4 stagger-children">
                                    {s.steps.map((step, i) => (
                                        <div key={i} className="flex gap-4 py-3">
                                            <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-sm font-black text-indigo-500 border border-indigo-500/20">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">{step.title}</h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{step.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Back to Dashboard */}
                <div className="mt-12 text-center">
                    <Link href="/">
                        <button className="px-6 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition-all inline-flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            Return to Dashboard
                        </button>
                    </Link>
                </div>
            </div>
        </AppShell>
    );
}
