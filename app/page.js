"use client";

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import ShowTable from "./components/ShowTable";
import PromoCodesModal from "./components/PromoCodesModal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "./components/Navbar";

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  // Auth guard: redirect to login if no active session on fresh load
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      } else {
        setAuthChecked(true);
        fetchLogs();
      }
    }
    checkAuth();
  }, []);

  async function fetchLogs() {
    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.error("Error getting user:", userError);
        setLoading(false);
        return;
      }

      // Fetch all shows and their participants
      // We want to see ALL shows so users can join them
      const { data, error } = await supabase
        .from("shows")
        .select(`
          *,
          show_participants (
            *
          )
        `)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching shows:", error);

        // Check for specific errors to give helpful feedback
        if (error.code === "PGRST116" || error.code === "42703" || error.message.includes("relation")) {
          console.error("Database schema mismatch. Please run the migration SQL.");
        }
        setLogs([]);
      } else {
        setLogs(data || []);
      }
    } catch (err) {
      console.error("Unexpected error in fetchLogs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  async function triggerAutoReset() {
    try {
      // Call internal API to trigger reset if needed
      await fetch('/api/reset-status');
      // Trigger alerts for overdue pending shows
      await fetch('/api/send-alerts');

      // Re-fetch logs to reflect any changes
      fetchLogs();
    } catch (e) {
      console.error("Auto-reset/Alert check failed:", e);
    }
  }

  // Poll for auto-reset every minute
  useEffect(() => {
    const interval = setInterval(triggerAutoReset, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, []);

  // Don't render anything until auth is confirmed — prevents dashboard flash
  if (!authChecked) return null;

  return (
    <div className="min-h-screen bg-[var(--background)] transition-colors duration-300">
      <Navbar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Dashboard
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Manage your show logs and monitor checks.
            </p>
          </div>
          <div className="mt-4 sm:ml-4 sm:mt-0 flex gap-3">
            <button
              onClick={() => setIsPromoModalOpen(true)}
              className="btn-shiny inline-flex items-center gap-x-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all active:scale-95"
            >
              <svg className="-ml-0.5 h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              Promo Codes
            </button>
            <Link href="/add">
              <button className="btn-shiny inline-flex items-center gap-x-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 hover:shadow-lg transition-all active:scale-95">
                <svg className="-ml-0.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                </svg>
                Add New Show
              </button>
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-base font-medium">Loading shows...</p>
            </div>
          ) : (
            <ShowTable logs={logs} />
          )}
        </div>

        {/* Footer with FAQ link */}
        <footer className="mt-10 pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400 dark:text-gray-500">
          <p>💡 All users can join shows and update their check status from the dashboard.</p>
          <Link href="/faq" className="flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300 font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Frequently Asked Questions
          </Link>
        </footer>

        {/* Promo Codes Modal */}
        <PromoCodesModal
          isOpen={isPromoModalOpen}
          onClose={() => setIsPromoModalOpen(false)}
          logs={logs}
          fetchLogs={fetchLogs}
        />
      </main>
    </div>
  );
}
