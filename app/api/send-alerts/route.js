import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
    try {
        const now = new Date();
        const intervalHours = 24 * 60 * 60 * 1000;

        // 1. Get all pending participants with their show info
        const { data: pendingParticipants, error: fetchError } = await supabaseAdmin
            .from("show_participants")
            .select(`
                id,
                user_id,
                show_id,
                status_changed_at,
                created_at,
                alert_sent_at,
                user_name,
                user_email,
                shows (name)
            `)
            .eq("status", false);

        if (fetchError) throw fetchError;

        if (!pendingParticipants || pendingParticipants.length === 0) {
            return Response.json({ success: true, message: "No pending participants", count: 0 });
        }

        // 2. Count how many shows EACH USER is participating in
        const { data: allParticipants, error: countError } = await supabaseAdmin
            .from("show_participants")
            .select("user_id");

        if (countError) throw countError;

        const userShowCounts = {};
        allParticipants?.forEach(p => {
            userShowCounts[p.user_id] = (userShowCounts[p.user_id] || 0) + 1;
        });

        // 3. Filter participants who are overdue (48hr threshold)
        const alertsToSend = [];
        pendingParticipants.forEach(participant => {
            const baseTimestamp = participant.status_changed_at || participant.created_at;
            if (!baseTimestamp) return; // skip if no timestamp at all
            const changedAt = new Date(baseTimestamp).getTime();
            const timeSinceChange = now.getTime() - changedAt;

            let recentlyAlerted = false;
            if (participant.alert_sent_at) {
                const alertedAt = new Date(participant.alert_sent_at).getTime();
                if (now.getTime() - alertedAt < intervalHours) {
                    recentlyAlerted = true;
                }
            }

            if (timeSinceChange > intervalHours && !recentlyAlerted) {
                alertsToSend.push({
                    ...participant,
                    userShowCount: userShowCounts[participant.user_id] || 1,
                    hoursOverdue: Math.floor(timeSinceChange / (1000 * 60 * 60))
                });
            }
        });

        if (alertsToSend.length === 0) {
            return Response.json({ success: true, message: "No overdue pending shows to alert", count: 0 });
        }

        // 4. Check Resend API key
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
            console.warn("RESEND_API_KEY not configured. Skipping email send.");
            return Response.json({
                success: false,
                message: "Email not configured. Please set RESEND_API_KEY in .env.local",
                alertsFound: alertsToSend.length
            });
        }

        // 5. Send Emails via Resend
        const results = [];
        for (const alert of alertsToSend) {
            const email = alert.user_email;
            const showName = alert.shows?.name || "Unknown Show";
            const userName = alert.user_name || "User";
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

            if (!email) {
                results.push({ user: userName, show: showName, status: "Skipped (no email on record)" });
                continue;
            }

            try {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${resendApiKey}`
                    },
                    body: JSON.stringify({
                        from: 'Show Check Log <onboarding@resend.dev>',
                        to: [email],
                        subject: `⚠️ Reminder: "${showName}" - Pending for ${alert.hoursOverdue}+ hours`,
                        html: `
                            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
                                <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                    <h2 style="color: #4f46e5; margin-top: 0; font-size: 24px; border-bottom: 3px solid #4f46e5; padding-bottom: 10px;">⚠️ Status Update Needed</h2>
                                    <p style="font-size: 16px; color: #1f2937;">Hi <strong>${userName}</strong>,</p>
                                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                                        <p style="margin: 0; color: #92400e; font-weight: 600;">⏰ Your show has been pending for <span style="font-size: 18px;">${alert.hoursOverdue} hours</span></p>
                                    </div>
                                    <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                                        Your show <strong style="color: #1f2937;">"${showName}"</strong> has been on <strong style="color: #dc2626;">PENDING</strong> status for over 24 hours.
                                    </p>
                                    <p style="font-size: 14px; color: #6b7280; background: #f3f4f6; padding: 10px; border-radius: 6px; margin: 15px 0;">
                                        📊 You're participating in <strong>${alert.userShowCount} show(s)</strong>.
                                    </p>
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="${siteUrl}" 
                                           style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                                            📝 Go to Dashboard
                                        </a>
                                    </div>
                                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
                                    <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
                                        This is an automated notification from Show Check Log.
                                    </p>
                                </div>
                            </div>
                        `
                    })
                });

                const resendData = await res.json();

                if (!res.ok) {
                    throw new Error(resendData.message || `Resend API error: ${res.status}`);
                }

                // Mark alert as sent
                await supabaseAdmin.from("show_participants").update({ alert_sent_at: new Date().toISOString() }).eq("id", alert.id);

                results.push({
                    user: userName, show: showName, email, hoursOverdue: alert.hoursOverdue,
                    status: "✅ Email sent successfully"
                });
                console.log(`✅ Alert email sent to ${email} for show "${showName}"`);
            } catch (mailError) {
                console.error("❌ Mail Error for", email, mailError);
                results.push({
                    user: userName, show: showName, email,
                    status: "❌ Error: " + mailError.message
                });
            }
        }

        return Response.json({
            success: true,
            message: `Processed ${results.length} alert(s)`,
            results,
            summary: {
                total: results.length,
                sent: results.filter(r => r.status.includes("✅")).length,
                failed: results.filter(r => r.status.includes("❌")).length,
                skipped: results.filter(r => r.status.includes("Skipped")).length
            }
        });

    } catch (error) {
        console.error("❌ Alert system error:", error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
