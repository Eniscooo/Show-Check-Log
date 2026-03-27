"use client";

import { useEffect } from "react";

export default function ConfirmModal({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel, isDanger = true }) {
    // Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-[#060a14]/80 backdrop-blur-sm animate-fadeIn"
                onClick={onCancel}
            />
            
            {/* Modal Panel */}
            <div className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full max-w-md p-6 overflow-hidden animate-springUp text-left">
                {/* Accent line */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${isDanger ? 'bg-red-500' : 'bg-blue-500'}`}></div>

                <div className="flex items-start gap-4 mb-6 mt-2">
                    {/* Icon */}
                    <div className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full border ${isDanger ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                        {isDanger ? (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>
                    
                    {/* Text */}
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-1.5 tracking-tight">
                            {title || "Please Confirm"}
                        </h3>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                    <button 
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-colors border border-transparent focus:outline-none"
                    >
                        {cancelText || "Cancel"}
                    </button>
                    <button 
                        onClick={() => {
                            onConfirm();
                            onCancel(); // Auto close
                        }}
                        className={`btn-shiny px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all focus:outline-none shadow-lg active:scale-[0.98] ${
                            isDanger 
                                ? 'bg-red-600 hover:bg-red-500 shadow-red-500/30' 
                                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'
                        }`}
                    >
                        {confirmText || "Confirm"}
                    </button>
                </div>
            </div>
        </div>
    );
}
