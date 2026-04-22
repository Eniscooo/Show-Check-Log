import { supabase } from "../../lib/supabase";

export async function GET(request) {
    try {
        const now = new Date();
        const interval12Hours = 12 * 60 * 60 * 1000;
        const interval24Hours = 24 * 60 * 60 * 1000;

        // 1. Get all checked participants
        const { data: checkedParticipants, error: fetchError } = await supabase
            .from("show_participants")
            .select("id, user_id, last_checked_at")
            .eq("status", true)
            .not("last_checked_at", "is", null);

        if (fetchError) throw fetchError;

        if (!checkedParticipants || checkedParticipants.length === 0) {
            return Response.json({ success: true, message: "No items need reset", resetCount: 0 });
        }

        // 2. Count how many shows EACH USER is participating in
        // Get unique user_ids from checkedParticipants to optimize fetching
        const uniqueUserIds = [...new Set(checkedParticipants.map(p => p.user_id))];

        // Fetch counts for all relevant users
        const { data: userShowCountsData, error: countError } = await supabase
            .from("show_participants")
            .select("user_id");

        if (countError) throw countError;

        const userShowCounts = {};
        userShowCountsData?.forEach(p => {
            userShowCounts[p.user_id] = (userShowCounts[p.user_id] || 0) + 1;
        });

        // 3. Determine which ones to reset
        const idsToReset = [];

        checkedParticipants.forEach(participant => {
            const count = userShowCounts[participant.user_id] || 1;
            // <=2 -> 24h, >=3 -> 12h
            const timeLimit = count >= 3 ? interval12Hours : interval24Hours;

            const lastChecked = new Date(participant.last_checked_at).getTime();

            if (now.getTime() - lastChecked > timeLimit) {
                idsToReset.push(participant.id);
            }
        });

        if (idsToReset.length === 0) {
            return Response.json({ success: true, message: "No items overdue", resetCount: 0 });
        }

        // 4. Perform the update
        const { error: updateError } = await supabase
            .from("show_participants")
            .update({
                status: false,
                last_checked_at: null,
                status_changed_at: now.toISOString()
            })
            .in("id", idsToReset);

        if (updateError) throw updateError;

        console.log(`Manual Reset: ${idsToReset.length} items reset to pending`);

        // 5. Clean up old activity logs (older than 1 week)
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { error: cleanupError } = await supabase
            .from("activity_log")
            .delete()
            .lt("created_at", oneWeekAgo);

        if (cleanupError) {
            console.error("Cleanup error:", cleanupError);
        } else {
            console.log("Cleanup: Removed activity logs older than 1 week");
        }

        return Response.json({
            success: true,
            message: `Reset ${idsToReset.length} items to pending`,
            resetCount: idsToReset.length
        });

    } catch (error) {
        console.error("Reset status error:", error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
