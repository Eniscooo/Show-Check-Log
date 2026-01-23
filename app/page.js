"use client";

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import ShowTable from "./components/ShowTable";
import NotificationBell from "./components/NotificationBell";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Filter logs by user_id
      const { data, error } = await supabase
        .from("show_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        // Check if error is about missing column (common error codes: PGRST116, 42703)
        const errorMessage = error.message || "";
        const errorCode = error.code || "";
        const errorDetails = error.details || "";
        
        console.error("Error fetching logs:");
        console.error("Message:", errorMessage);
        console.error("Code:", errorCode);
        console.error("Details:", errorDetails);
        console.error("Full error:", JSON.stringify(error, null, 2));
        
        // If column doesn't exist, provide helpful message
        if (errorMessage.includes("user_id") || errorMessage.includes("column") || 
            errorCode === "PGRST116" || errorCode === "42703" ||
            errorDetails.includes("user_id")) {
          console.error("\n⚠️  The 'user_id' column doesn't exist in your 'show_logs' table.");
          console.error("Please run this SQL in your Supabase SQL Editor:");
          console.error("ALTER TABLE show_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);");
          console.error("\nFor now, fetching all logs (not filtered by user)...");
          
          // Temporary fallback: fetch all logs
          const { data: allData, error: allError } = await supabase
            .from("show_logs")
            .select("*")
            .order("created_at", { ascending: true });
          
          if (allError) {
            console.error("Error fetching logs (fallback):", allError);
            setLogs([]);
          } else {
            setLogs(allData || []);
          }
        } else {
          setLogs([]);
        }
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function triggerAutoReset() {
    try {
      // Call internal API to trigger reset if needed
      await fetch('/api/reset-status');
      // Re-fetch logs to reflect any changes
      fetchLogs();
    } catch (e) {
      console.error("Auto-reset check failed:", e);
    }
  }

  // Poll for auto-reset every minute
  useEffect(() => {
    const interval = setInterval(triggerAutoReset, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-slate-900 shadow-lg border-b border-white/10 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 opacity-50"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20 backdrop-blur-sm">
              <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Show Check Log</h1>
              <p className="text-xs text-indigo-200/60 font-medium">Monitoring Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="bg-white/5 rounded-full p-1 border border-white/10 hover:bg-white/10 transition-colors">
              <NotificationBell />
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-semibold transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </header>

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
