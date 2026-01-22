"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const dropdownRef = useRef(null);

    // Check for 8-hour overdue items every minute
    useEffect(() => {
        checkForOverdueItems();
        const interval = setInterval(checkForOverdueItems, 60000);
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
        const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);

        // Get all shows with their users
        const { data: shows } = await supabase
            .from("show_logs")
            .select("id, show_name");

        if (!shows) return;

        const newNotifications = [];

        for (const show of shows) {
            const { data: users } = await supabase
                .from("show_users")
                .select("*")
                .eq("show_id", show.id);

            if (!users || users.length === 0) continue;

            // Check if ALL users are pending
            const allPending = users.every(u => !u.status);

            // Check if last check date is more than 8 hours ago
            const lastChecked = users
                .filter(u => u.date_checked)
                .map(u => new Date(u.date_checked + 'T' + (u.time_checked || '00:00')))
                .sort((a, b) => b - a)[0];

            if (allPending && lastChecked && lastChecked < eightHoursAgo) {
                // Calculate hours overdue
                const hoursOverdue = Math.floor((Date.now() - lastChecked) / (1000 * 60 * 60));
                newNotifications.push({
                    id: show.id,
                    message: `No checks for "${show.show_name}" in ${hoursOverdue} hours`,
                    showName: show.show_name,
                    hoursOverdue,
                    timestamp: new Date().toISOString()
                });
            }
        }

        if (newNotifications.length > 0) {
            setNotifications(newNotifications);
            setHasUnread(true);
            // Play ding sound
            playDingSound();
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
                {(hasUnread || notifications.length > 0) && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                        {notifications.length || '!'}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">🔔 Notifications</h3>
                        {notifications.length > 0 && (
                            <button onClick={clearNotifications} className="text-xs text-gray-500 hover:text-gray-700">
                                Clear all
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-gray-500">
                                <p className="text-sm">No overdue alerts</p>
                                <p className="text-xs mt-1">Alerts trigger when all users are pending for 8+ hours</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {notifications.map(notif => (
                                    <li key={notif.id} className="px-4 py-3 hover:bg-gray-50">
                                        <div className="flex items-start gap-3">
                                            <span className="text-red-500 text-lg">⚠️</span>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{notif.message}</p>
                                                <p className="text-xs text-gray-500 mt-1">All users pending - needs attention</p>
                                            </div>
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
