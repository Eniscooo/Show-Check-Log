"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import ConfirmModal from "./ConfirmModal";

export default function PromoCodesModal({ isOpen, onClose, logs, fetchLogs }) {
    const [selectedShow, setSelectedShow] = useState("");
    const [newPromo, setNewPromo] = useState("");
    const [adding, setAdding] = useState(false);
    const [copiedPromo, setCopiedPromo] = useState(null);

    // Confirm Modal state
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: "",
        message: "",
        isDanger: true,
        confirmText: "Confirm",
        onConfirm: () => { }
    });

    // Shows that actually have promo codes, or just all shows
    const showsWithPromos = logs.filter(log => log.promo_code && log.promo_code.trim() !== "");

    if (!isOpen) return null;

    async function handleAddPromo(e) {
        e.preventDefault();
        if (!selectedShow || !newPromo.trim()) return;

        setAdding(true);

        const show = logs.find(l => l.id === selectedShow);
        if (!show) {
            setAdding(false);
            return;
        }

        const existingPromos = show.promo_code ? show.promo_code.split(',').map(p => p.trim()).filter(Boolean) : [];
        if (existingPromos.includes(newPromo.trim())) {
            toast.error("This promo code already exists for this show.");
            setAdding(false);
            return;
        }

        const updatedPromos = [...existingPromos, newPromo.trim()].join(", ");

        const { error } = await supabase
            .from("shows")
            .update({ promo_code: updatedPromos })
            .eq("id", selectedShow);

        if (!error) {
            setNewPromo("");
            fetchLogs();
            toast.success("Promo code added");
        } else {
            toast.error("Error saving promo code");
            console.error(error);
        }
        setAdding(false);
    }

    function handleDeletePromoClick(showId, promoToDelete) {
        setConfirmModal({
            isOpen: true,
            title: "Delete Promo",
            message: `Are you sure you want to delete the code '${promoToDelete}'?`,
            isDanger: true,
            confirmText: "Delete",
            onConfirm: () => executeDeletePromo(showId, promoToDelete)
        });
    }

    async function executeDeletePromo(showId, promoToDelete) {

        const show = logs.find(l => l.id === showId);
        if (!show) return;

        const existingPromos = show.promo_code ? show.promo_code.split(',').map(p => p.trim()).filter(Boolean) : [];
        const updatedPromos = existingPromos.filter(p => p !== promoToDelete).join(", ");

        const { error } = await supabase
            .from("shows")
            .update({ promo_code: updatedPromos })
            .eq("id", showId);

        if (!error) {
            fetchLogs();
            toast.success("Promo code deleted");
        } else {
            toast.error("Error deleting promo code");
        }
    }

    function handleCopy(text) {
        navigator.clipboard.writeText(text);
        setCopiedPromo(text);
        setTimeout(() => setCopiedPromo(null), 2000);
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 transition-all">
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                isDanger={confirmModal.isDanger}
                confirmText={confirmModal.confirmText}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />

            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden flex flex-col md:max-h-[85vh] max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/20">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <span className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                        </span>
                        Promo Codes
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-all border border-gray-200 dark:border-slate-700 shadow-sm">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">

                    {/* Add New Promo Section */}
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Add Promo to Show</h3>
                        <form onSubmit={handleAddPromo} className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                                <select
                                    className="w-full text-sm px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white transition-all font-medium appearance-none"
                                    value={selectedShow}
                                    onChange={e => setSelectedShow(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Select a Show...</option>
                                    {logs.map(log => (
                                        <option key={log.id} value={log.id}>{log.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="Enter Promo Code (e.g. FREE2024)"
                                    className="w-full text-sm px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold uppercase dark:text-white transition-all"
                                    value={newPromo}
                                    onChange={e => setNewPromo(e.target.value)}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={adding || !selectedShow || !newPromo.trim()}
                                className="sm:w-auto w-full px-6 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                            >
                                {adding ? "Adding..." : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                        Add
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Directory List */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 px-1">Active Show Promo Codes</h3>

                        {showsWithPromos.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl bg-gray-50/50 dark:bg-slate-800/20">
                                <svg className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">No promo codes active yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {showsWithPromos.map(log => {
                                    const codes = log.promo_code.split(',').map(p => p.trim()).filter(Boolean);
                                    if (codes.length === 0) return null;

                                    return (
                                        <div key={log.id} className="bg-white dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                            {/* Show header */}
                                            <div className="px-5 py-3 bg-indigo-50/50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between">
                                                <h4 className="font-extrabold text-slate-800 dark:text-white capitalize flex items-center gap-2">
                                                    {log.name}
                                                </h4>
                                                <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 px-2 py-0.5 rounded-md font-bold">{codes.length} code{codes.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            {/* Ordered list */}
                                            <ol className="divide-y divide-gray-100 dark:divide-slate-700/40">
                                                {codes.map((code, idx) => (
                                                    <li key={idx} className="flex items-center justify-between px-5 py-3 group hover:bg-indigo-50/30 dark:hover:bg-slate-700/30 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400 text-[11px] font-black flex items-center justify-center">{idx + 1}</span>
                                                            <span className="font-bold tracking-wider text-sm text-indigo-700 dark:text-indigo-300 uppercase">{code}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                onClick={() => handleCopy(code)}
                                                                className="p-1.5 text-gray-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"
                                                                title="Copy code"
                                                            >
                                                                {copiedPromo === code ? (
                                                                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                ) : (
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeletePromoClick(log.id, code)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                                                title="Delete code"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
