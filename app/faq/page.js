"use client";

import Link from "next/link";
import Navbar from "../components/Navbar";
import { useState } from "react";

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState(null);

    const faqs = [
        {
            question: "What is Show Check Log?",
            answer: "Show Check Log is a monitoring dashboard that helps teams keep track of which shows have been checked and monitored on external platforms. It visually highlights shows needing checks using priority colors and automates tracking."
        },
        {
            question: "How do I delete shows?",
            answer: "Only registered administrators can delete shows. Regular users will receive an access warning if they attempt to delete a show."
        },
        {
            question: "What do the priority colors (High, Medium, Low) mean?",
            answer: "Setting a Priority gives a visual left-border indication on the dashboard to ensure critical shows are checked first. High corresponds to Red, Medium to Orange, and Low to Yellow."
        },
        {
            question: "How do the Email Push Notifications work?",
            answer: "The system automatically polls active shows. If a show's status remains 'Pending' for over 24 hours (or 12 hours if you're actively monitoring more than 3 shows), the system sends an email reminder directly to your inbox to check it. You will only receive a maximum of one reminder per 12-hour period."
        },
        {
            question: "How do I edit show details or change priority?",
            answer: "On the dashboard, locate the show you want to edit and click the 'Edit' button in the Actions column. From there, you can adjust priority levels using the labeled selection buttons."
        },
        {
            question: "Can I manage who deletes shows?",
            answer: "Yes. Only registered administrators can delete shows. Regular users will receive an access warning if they attempt to delete a show."
        }
    ];

    const toggleOpen = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className="min-h-screen bg-[var(--background)] transition-colors duration-300">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Frequently Asked Questions</h1>
                    <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        Everything you need to know about navigating and utilizing the Show Check dashboard for your team.
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-indigo-500/5 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
                    <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
                        {faqs.map((faq, index) => (
                            <div key={index} className="group">
                                <button
                                    onClick={() => toggleOpen(index)}
                                    className="w-full text-left px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between focus:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {faq.question}
                                    </span>
                                    <span className="ml-6 flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-500 transition-transform duration-300" style={{ transform: openIndex === index ? 'rotate(180deg)' : 'rotate(0)' }}>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                    </span>
                                </button>
                                <div
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                                >
                                    <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-2 text-gray-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed border-l-[3px] border-indigo-500 ml-6 sm:ml-8 pl-4 mb-4">
                                        {faq.answer}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <Link href="/">
                        <button className="px-6 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition-all inline-flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            Return to Dashboard
                        </button>
                    </Link>
                </div>
            </main>
        </div>
    );
}
