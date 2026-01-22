
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateOldCheck() {
    console.log("Simulating an old check (9 hours ago)...");

    // 1. Get the first available show
    const { data: shows } = await supabase.from('show_logs').select('id, show_name').limit(1);

    if (!shows || shows.length === 0) {
        console.log("No shows found to test with.");
        return;
    }

    const show = shows[0];
    console.log(`Testing with show: ${show.show_name} (${show.id})`);

    // 2. Update it to be "Checked" with a timestamp 9 hours ago
    const nineHoursAgo = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from('show_logs')
        .update({
            status: true,
            status_updated_at: nineHoursAgo
        })
        .eq('id', show.id);

    if (error) {
        console.error("Failed to update show:", error);
    } else {
        console.log("✅ Success! Show marked as checked 9 hours ago.");
        console.log("The auto-reset logic in the dashboard (or /api/reset-status) should now pick this up and reset it to 'Pending'.");
    }
}

simulateOldCheck();
