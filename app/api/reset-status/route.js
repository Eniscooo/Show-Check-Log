import { supabase } from "../../lib/supabase";

export async function GET(request) {
    try {
        // Get reset interval from alert_settings (default 8 hours)
        const { data: settings } = await supabase
            .from("alert_settings")
            .select("*")
            .single();

        const resetHours = settings?.reset_interval_hours || 8;
        const thresholdMs = resetHours * 60 * 60 * 1000;
        const now = new Date();

        // Find all checked items where status_updated_at is older than threshold
        const { data: checkedLogs, error: logsError } = await supabase
            .from("show_logs")
            .select("*")
            .eq("status", true)
            .not("status_updated_at", "is", null);

        if (logsError) {
            return Response.json({
                success: false,
                error: "Failed to fetch logs"
            }, { status: 500 });
        }

        // Filter items that need to be reset
        const itemsToReset = checkedLogs?.filter(log => {
            const updatedAt = new Date(log.status_updated_at);
            return (now - updatedAt) > thresholdMs;
        }) || [];

        if (itemsToReset.length === 0) {
            return Response.json({
                success: true,
                message: "No items need to be reset",
                resetCount: 0
            });
        }

        // Reset all overdue items to pending
        const idsToReset = itemsToReset.map(item => item.id);

        const { error: updateError } = await supabase
            .from("show_logs")
            .update({
                status: false,
                status_updated_at: null
            })
            .in("id", idsToReset);

        if (updateError) {
            return Response.json({
                success: false,
                error: "Failed to reset items"
            }, { status: 500 });
        }

        console.log(`Auto-reset: ${itemsToReset.length} items reset to pending`);

        return Response.json({
            success: true,
            message: `Reset ${itemsToReset.length} items to pending`,
            resetCount: itemsToReset.length,
            items: itemsToReset.map(i => ({ id: i.id, show_name: i.show_name }))
        });

    } catch (error) {
        console.error("Reset status error:", error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
