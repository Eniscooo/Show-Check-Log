"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const dropdownRef = useRef(null);

    // Initial check + periodic re-check
    useEffect(() => {
        checkForOverdueItems();
        // Re-check every 30 minutes
        const interval = setInterval(checkForOverdueItems, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function checkForOverdueItems() {
        // If user has cleared notifications, respect that until next fresh check window
        const dismissedUntil = localStorage.getItem('notificationsDismissedUntil');
        if (dismissedUntil) {
            const dismissTime = parseInt(dismissedUntil);
            // Respect the dismiss for 2 hours
            if (Date.now() - dismissTime < 2 * 60 * 60 * 1000) {
                setNotifications([]);
                setHasUnread(false);
                return;
            } else {
                // Dismiss window expired, allow fresh check
                localStorage.removeItem('notificationsDismissedUntil');
            }
        }

        try {
            // Get all shows with their participants
            const { data: shows, error } = await supabase
                .from("shows")
                .select(`
                    id, 
                    name,
                    show_participants (
                        id,
                        user_id,
                        status,
                        last_checked_at,
                        status_changed_at,
                        created_at
                    )
                `);

            if (error || !shows) {
                console.error("Error checking notifications:", error);
                return;
            }

            const newNotifications = [];
            const now = new Date();
            const OVERDUE_HOURS = 48; // Alert after 48 hours as requested
            const timeLimit = OVERDUE_HOURS * 60 * 60 * 1000;

            for (const show of shows) {
                const participants = show.show_participants || [];
                
                // Skip if no participants
                if (participants.length === 0) continue;

                // Check if ALL participants in this show are pending (status === false)
                const allPending = participants.every(p => p.status === false || p.status === null);
                
                if (!allPending) continue; // At least one user has checked — not overdue

                // Find the oldest pending participant's timestamp
                let oldestPendingTime = null;
                for (const participant of participants) {
                    const baseTime = new Date(
                        participant.status_changed_at || participant.created_at || now
                    ).getTime();
                    
                    if (!oldestPendingTime || baseTime < oldestPendingTime) {
                        oldestPendingTime = baseTime;
                    }
                }

                if (oldestPendingTime && (now.getTime() - oldestPendingTime > timeLimit)) {
                    const hoursOverdue = Math.floor((now.getTime() - oldestPendingTime) / (1000 * 60 * 60));

                    newNotifications.push({
                        id: `show-${show.id}`,
                        message: `"${show.name}" — all users pending for ${hoursOverdue}h`,
                        showName: show.name,
                        hoursOverdue,
                        timestamp: now.toISOString()
                    });
                }
            }

            setNotifications(newNotifications);
            setHasUnread(newNotifications.length > 0);

        } catch (err) {
            console.error("Notification check failed:", err);
        }
    }

    function playDingSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log("Audio not available");
        }
    }

    function handleBellClick() {
        setIsOpen(!isOpen);
        if (!isOpen) {
            setHasUnread(false);
        }
    }

    function clearNotifications() {
        setNotifications([]);
        setHasUnread(false);
        setIsOpen(false);
        // Store a dismiss timestamp so on refresh we don't immediately reload them
        localStorage.setItem('notificationsDismissedUntil', Date.now().toString());
    }

    function dismissSingle(notifId) {
        setNotifications(prev => {
            const updated = prev.filter(n => n.id !== notifId);
            if (updated.length === 0) {
                setHasUnread(false);
                localStorage.setItem('notificationsDismissedUntil', Date.now().toString());
            }
            return updated;
        });
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={handleBellClick}
                className="relative text-slate-400 hover:text-white transition-colors p-2"
                title="Notifications"
            >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>

                {/* Notification Badge */}
                {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                        {notifications.length}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.4)] border border-white/10 z-50">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                        <h3 className="font-semibold text-white text-sm">🔔 Notifications</h3>
                        {notifications.length > 0 && (
                            <button onClick={clearNotifications} className="text-xs text-gray-400 hover:text-white transition-colors">
                                Clear all
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm text-gray-400">No overdue alerts</p>
                                <p className="text-xs text-gray-600 mt-1">Alerts trigger when all users are pending for 48+ hours</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-white/5">
                                {notifications.map(notif => (
                                    <li key={notif.id} className="px-4 py-3 hover:bg-white/5 transition-colors group">
                                        <div className="flex items-start gap-3">
                                            <span className="text-red-500 text-lg shrink-0">⚠️</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-200">{notif.message}</p>
                                                <p className="text-xs text-gray-500 mt-1">All users pending — needs attention</p>
                                            </div>
                                            <button
                                                onClick={() => dismissSingle(notif.id)}
                                                className="text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                                title="Dismiss"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
