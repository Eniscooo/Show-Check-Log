"use client";

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import ShowTable from "./components/ShowTable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "./components/Navbar";

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchLogs();
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

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Navbar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Dashboard
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Manage your show logs and monitor checks.
            </p>
          </div>
          <div className="mt-4 sm:ml-4 sm:mt-0">
            <Link href="/add">
              <button className="inline-flex items-center gap-x-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 hover:shadow-lg transition-all active:scale-95">
                <svg className="-ml-0.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                </svg>
                Add New Show
              </button>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xl ring-1 ring-black/5 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-base font-medium">Loading shows...</p>
            </div>
          ) : (
            <ShowTable logs={logs} />
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm text-sm text-gray-600">
          <span className="text-xl">💡</span>
          <div>
            <strong className="block text-gray-900 mb-1">Alert System Guide</strong>
            All users can join show and edit from the dashboard.
          </div>
        </div>
      </main>
    </div>
  );
}
