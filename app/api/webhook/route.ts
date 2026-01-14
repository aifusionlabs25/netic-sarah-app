
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Resend } from 'resend'; // Switched from GmailDraft to Resend for "Spoofing"
import { OpenAIService } from '@/lib/openai-service';
import { CONFIG } from '@/lib/config';
import { SalesforceService } from '@/lib/salesforce-service';
import { generateMeetingOptions } from '@/lib/calendar-service';

// Allow webhook to run for up to 60 seconds (Vercel Limit) to wait for transcripts
export const maxDuration = 60;

// Google Sheets Auth Helper
const getPrivateKey = () => {
    const key = process.env.GOOGLE_PRIVATE_KEY;
    if (!key) return undefined;
    return key.replace(/\\n/g, '\n').replace(/"/g, '');
};

let sheetsClient: any = null;
function getSheetsClient() {
    if (sheetsClient) return sheetsClient;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEET_ID) {
        try {
            const auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    private_key: getPrivateKey(),
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            sheetsClient = google.sheets({ version: 'v4', auth });
            return sheetsClient;
        } catch (e) {
            console.error('[Sheets Auth Error]', e);
            return null;
        }
    }
    return null;
}

// ============================================================================
// NOVA FIX: Normalize Transcript (Array -> String)
// Tavus verbose mode returns transcript as array of {role, content} objects.
// ============================================================================
function normalizeTranscript(rawTranscript: any): string {
    if (!rawTranscript) return "";

    // If already a string, return as-is
    if (typeof rawTranscript === 'string') return rawTranscript;

    // If array (Tavus format), convert to readable string
    if (Array.isArray(rawTranscript)) {
        // Track unique messages to prevent duplicates (Event Stream issue)
        const seen = new Set<string>();

        return rawTranscript
            .map((t: any) => {
                // PRIORITIZE distinct content over history
                const role = t.role || t.sender || 'unknown';
                const content = t.content || t.text || t.message || '';

                // IGNORE System Prompts (The main source of bloat)
                if (role.toLowerCase() === 'system') return null;

                // If content is empty, ignore this entry (it's likely a system event or metadata)
                if (!content || typeof content !== 'string') return null;

                const line = `${role}: ${content}`;

                // Effective Deduplication
                if (seen.has(line)) return null;
                seen.add(line);

                return line;
            })
            .filter(Boolean) // Remove nulls
            .join('\n');
    }

    // Fallback: Try to stringify
    try {
        return JSON.stringify(rawTranscript);
    } catch {
        return "";
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const eventType = body.event_type || 'unknown';
        const conversation_id = body.conversation_id;

        console.log(`[Webhook] Received event: ${eventType} from conversation: ${conversation_id}`);

        // NOVA DEMO-PROOFING: Verification log for quick debugging
        console.log(`[Webhook] 🔍 VERIFY: Model=${CONFIG.OPENAI.MODEL}, Event=${eventType}, ConvoID=${conversation_id}`);

        // ============================================================================
        // NOVA FIX #4: Shutdown just ACKs (no transcript available in this event)
        // ============================================================================
        if (eventType === 'system.shutdown') {
            console.log('[Webhook] Shutdown ACK. No analysis (transcript not in this event).');
            return NextResponse.json({ message: 'Shutdown acknowledged' });
        }

        // ============================================================================
        // SINGLE TRIGGER: Only analyze on transcription_ready (where transcript lives)
        // ============================================================================
        if (eventType === 'application.transcription_ready') {

            console.log(`[Webhook] 📜 Transcript Ready for ${conversation_id}. Starting Hot Lead Analysis...`);

            let transcriptText = "";
            let tavusRecordingUrl: string | null = null;
            let leadData: any = null; // Hoisted for visibility in fallback logger

            // ============================================================================
            // NOVA FIX #1: PREFER WEBHOOK PAYLOAD TRANSCRIPT (Faster, fewer moving parts)
            // ============================================================================
            if (body.properties && body.properties.transcript) {
                console.log('[Webhook] Found transcript in webhook payload (body.properties.transcript).');
                transcriptText = normalizeTranscript(body.properties.transcript);
                console.log(`[Webhook] Payload Transcript Length (Normalized): ${transcriptText.length} chars`);
            } else if (body.transcript) {
                console.log('[Webhook] Found transcript in webhook payload (body.transcript).');
                transcriptText = normalizeTranscript(body.transcript);
                console.log(`[Webhook] Payload Transcript Length (Normalized): ${transcriptText.length} chars`);
            }

            // ============================================================================
            // NOVA FIX #2: ONLY HIT TAVUS API IF PAYLOAD MISSING/SHORT (Fallback Only)
            // ============================================================================
            // ============================================================================
            // NOVA FIX #2: ALWAYS SYNC WITH TAVUS API (Metadata + Recording URL)
            // Even if we have transcript, we need the recording_url and other metadata.
            // ============================================================================
            if (process.env.TAVUS_API_KEY) {
                console.log('[Webhook] Syncing conversation metadata definitions...');

                // Retry loop: 3 attempts
                const delays = [2000, 4000, 6000];

                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        const transcriptResponse = await fetch(`${CONFIG.TAVUS.API_URL}/conversations/${conversation_id}?verbose=true`, {
                            method: 'GET',
                            headers: { 'x-api-key': process.env.TAVUS_API_KEY },
                        });

                        if (transcriptResponse.ok) {
                            const convoData = await transcriptResponse.json();

                            // 1. Sync Recording URL (Critical for Internal Email)
                            if (convoData.recording_url) {
                                tavusRecordingUrl = convoData.recording_url;
                                console.log('[Webhook] ✅ Captured Public Recording URL:', tavusRecordingUrl);
                            }

                            // 2. Sync / Enrich Transcript if better version found
                            if (convoData.transcript) {
                                const apiTranscript = normalizeTranscript(convoData.transcript);
                                if (apiTranscript.length > transcriptText.length) {
                                    transcriptText = apiTranscript;
                                    console.log(`[Webhook] Enriched transcript from API (${transcriptText.length} chars)`);
                                }
                            }

                            break; // Success
                        }
                    } catch (err) {
                        console.error(`[Webhook] API fetch failed attempt ${attempt + 1}:`, err);
                    }

                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, delays[attempt]));
                    }
                }
            }

            // ============================================================================
            // AI ANALYSIS: Only attempt if transcript is substantial AND OpenAI is configured
            // ============================================================================
            if (transcriptText && transcriptText.length >= 50) {
                console.log(`[Webhook] ✅ Analyzing ${transcriptText.length} chars with ${CONFIG.OPENAI.MODEL}...`);
                console.log(`[Webhook] 📜 NORMALIZED TRANSCRIPT PREVIEW:`, transcriptText.substring(0, 500) + '...');

                // Check for API key BEFORE instantiation to avoid crash
                if (!process.env.OPENAI_API_KEY) {
                    console.warn('[Webhook] ⚠️ OPENAI_API_KEY not configured. Skipping AI analysis, using fallback data.');
                } else {
                    try {
                        const aiService = new OpenAIService();
                        leadData = await aiService.analyzeTranscript(transcriptText);
                        console.log('[Webhook] ✅ AI Analysis completed successfully.');
                    } catch (error: any) {
                        console.error('[Webhook] ❌ AI Analysis Failed:', error.message || error);
                        // Continue with fallback data - don't crash
                    }
                }
            } else {
                console.log(`[Webhook] ⚠️ Transcript too short for AI analysis (${transcriptText.length} chars). Using fallback data.`);
            }


            // ============================================================================
            // ALWAYS CREATE FALLBACK DATA (for analytics - track all sessions)
            // ============================================================================
            if (!leadData) {
                leadData = {
                    lead_name: 'Short Session User',
                    role: 'Unknown',
                    company_name: 'Unknown',
                    lead_email: '',
                    lead_phone: '',
                    budget_range: 'Unknown',
                    timeline: 'Unknown',
                    pain_points: [],
                    buying_committee: [],
                    vertical: 'Unknown',
                    teamSize: 'Unknown',
                    geography: 'Unknown',
                    currentSystems: 'Unknown',
                    salesPlan: `Session ended with ${transcriptText.length} chars of transcript. May have been a test or abandoned session.`,
                    morgan_action: 'Session ended before meaningful conversation',
                    team_action: 'No action needed - short session',
                    followUpEmail: '<p>Thanks for stopping by! If you have any questions about Netic, feel free to reach out.</p><p>Best,<br>Sarah</p>'
                };
            }

            // ============================================================================
            // TRUST VERIFIED IDENTITY (Override defaults with AccessGate data)
            // ============================================================================
            if (body.properties && body.properties.user_email) {
                leadData.lead_email = body.properties.user_email;
                if (body.properties.user_name) leadData.lead_name = body.properties.user_name;
                console.log('[Webhook] 📧 Enforcing Verified User Identity:', leadData.lead_email);
            }

            // ============================================================================
            // ALWAYS SEND BOTH EMAILS (for analytics tracking)
            // ============================================================================
            console.log('[Webhook] Sending emails (always-send mode for analytics)...');

            if (process.env.RESEND_API_KEY) {
                const resend = new Resend(process.env.RESEND_API_KEY);

                // Fallback to aifusionlabs@gmail.com if lead email is missing
                const recipient = leadData.lead_email && leadData.lead_email.includes('@') ? leadData.lead_email : 'aifusionlabs@gmail.com';

                // Generate ICS calendar options if Sarah proposed meeting times
                let calendarSection = '';
                const attachments: Array<{ filename: string; content: Buffer }> = [];

                if (leadData.proposed_meeting_times && leadData.proposed_meeting_times.length > 0) {
                    const meetingOptions = generateMeetingOptions(
                        leadData.proposed_meeting_times,
                        recipient,
                        leadData.lead_name || 'there',
                        leadData.company_name || 'Your Company'
                    );

                    if (meetingOptions.length > 0) {
                        calendarSection = `
                        <div style="background: linear-gradient(135deg, #0B3B28 0%, #134e3a 100%); border-radius: 12px; padding: 24px; margin: 24px 0;">
                            <h3 style="color: #10B981; margin: 0 0 16px 0; font-size: 18px;">📅 Schedule Your Demo</h3>
                            <p style="color: #d1fae5; margin: 0 0 16px 0; font-size: 14px;">I've attached calendar invites for the times we discussed. Choose whichever works best for you:</p>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${meetingOptions.map((opt, idx) => `
                                    <div style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10B981; border-radius: 8px; padding: 12px 16px; color: #d1fae5; font-size: 13px;">
                                        <strong>Option ${idx + 1}:</strong> ${opt.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${opt.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                    </div>
                                `).join('')}
                            </div>
                            <p style="color: #a7f3d0; margin: 16px 0 0 0; font-size: 12px;">📎 Calendar invites attached - just open the .ics file to add to your calendar</p>
                        </div>
                        `;

                        // Create ICS attachments
                        meetingOptions.forEach((opt, idx) => {
                            attachments.push({
                                filename: `netic-demo-option-${idx + 1}.ics`,
                                content: Buffer.from(opt.ics, 'utf-8')
                            });
                        });
                    }
                }

                // 1. SARAH FOLLOW-UP EMAIL - Netic Branded
                const emailBodyHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background-color: #f8faf9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                        
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #0B3B28 0%, #134e3a 100%); padding: 32px 24px; text-align: center;">
                            <img src="https://uploads-ssl.webflow.com/672bd420dfed92b3af3ed50c/672bd420dfed92b3af3ed5e6_Netic%20Logo%20White.svg" alt="Netic" style="height: 32px; margin-bottom: 16px;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Thanks for chatting with me!</h1>
                            <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">Here's everything we discussed</p>
                        </div>

                        <!-- Main Content -->
                        <div style="padding: 32px 24px;">
                            <div style="color: #374151; font-size: 15px; line-height: 1.7;">
                                ${leadData.followUpEmail}
                            </div>

                            ${calendarSection}
                        </div>

                        <!-- Footer -->
                        <div style="background-color: #f8faf9; padding: 24px; border-top: 1px solid #e5e7eb;">
                            <table style="width: 100%;">
                                <tr>
                                    <td style="vertical-align: top;">
                                        <p style="margin: 0 0 4px 0; font-weight: 600; color: #0B3B28;">Sarah</p>
                                        <p style="margin: 0; color: #6b7280; font-size: 13px;">Senior Revenue Specialist</p>
                                        <p style="margin: 4px 0 0 0;">
                                            <a href="https://www.netic.ai" style="color: #10B981; text-decoration: none; font-size: 13px;">netic.ai</a>
                                        </p>
                                    </td>
                                    <td style="vertical-align: top; text-align: right;">
                                        <img src="https://uploads-ssl.webflow.com/672bd420dfed92b3af3ed50c/672bd420dfed92b3af3ed5e7_Netic%20Icon.svg" alt="" style="height: 40px; opacity: 0.5;">
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </body>
                </html>
                `;

                await resend.emails.send({
                    from: 'Sarah at Netic <noreply@aifusionlabs.app>',
                    to: [recipient, 'aifusionlabs@gmail.com'],
                    subject: `${leadData.lead_name || 'Hi'} - Your Netic Demo Follow-up`,
                    html: emailBodyHtml,
                    attachments: attachments.length > 0 ? attachments : undefined
                });
                console.log('✅ [Webhook] Sent branded email to:', recipient, `with ${attachments.length} calendar attachments`);


                // 2. INTERNAL LEAD ALERT (Intelligence Email)
                console.log('[Webhook] Sending Internal Lead Alert...');

                const internalBodyHtml = `
                <div style="font-family: sans-serif; padding: 20px; line-height: 1.5; color: #333; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px;">
                    <div style="border-bottom: 2px solid #10B981; padding-bottom: 10px; margin-bottom: 15px;">
                        <h2 style="color: #10B981; margin: 0;">🚨 Session Alert</h2>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Conversation ID: ${conversation_id}</p>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">Transcript Length: ${transcriptText.length} chars</p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <h3 style="margin-bottom: 10px; color: #111;">👤 Prospect</h3>
                            <p style="margin: 5px 0;"><strong>Name:</strong> ${leadData.lead_name}</p>
                            <p style="margin: 5px 0;"><strong>Role:</strong> ${leadData.role}</p>
                            <p style="margin: 5px 0;"><strong>Company:</strong> ${leadData.company_name}</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> ${leadData.lead_email || 'Not provided'}</p>
                            <p style="margin: 5px 0;"><strong>Location:</strong> ${leadData.geography}</p>
                        </div>
                        <div>
                            <h3 style="margin-bottom: 10px; color: #111;">🏢 Organization</h3>
                            <p style="margin: 5px 0;"><strong>Vertical:</strong> ${leadData.vertical}</p>
                            <p style="margin: 5px 0;"><strong>Team Size:</strong> ${leadData.teamSize}</p>
                            <p style="margin: 5px 0;"><strong>Budget:</strong> ${leadData.budget_range}</p>
                            <p style="margin: 5px 0;"><strong>Systems:</strong> ${leadData.currentSystems}</p>
                        </div>
                    </div>

                    <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0;">

                    <h3 style="color: #111;">⚠️ Pain Points</h3>
                    <ul style="background: #fff; padding: 15px 20px; border-radius: 4px; border: 1px solid #e5e5e5;">
                        ${(leadData.pain_points || []).length > 0 ? (leadData.pain_points || []).map((p: string) => `<li>${p}</li>`).join('') : '<li>No pain points captured (short session)</li>'}
                    </ul>

                    <h3 style="color: #111;">🤖 AI Analysis & Next Steps</h3>
                    <div style="background: #eef2ff; padding: 15px; border-radius: 4px; margin-bottom: 10px; border-left: 4px solid #6366f1;">
                        <strong>Sarah's Action:</strong><br>
                        ${leadData.morgan_action || 'Standard follow-up sent.'}
                    </div>
                    <div style="background: #fdf2f8; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #ec4899;">
                        <strong>Recommended Team Action:</strong><br>
                        ${leadData.team_action || 'Call to verify lead details.'}
                    </div>

                    <div style="text-align: center; margin-top: 30px;">
                        ${tavusRecordingUrl
                        ? `<a href="${tavusRecordingUrl}" style="background-color: #333; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Conversation Record</a>
                               <p style="margin-top: 10px; font-size: 12px; color: #999;">Link expires in 7 days</p>`
                        : `<div style="background-color: #eee; color: #666; padding: 12px 25px; border-radius: 6px; display: inline-block;">Video Processing...</div>
                               <p style="margin-top: 10px; font-size: 12px; color: #999;">Recording will be available in your Dashboard shortly.</p>`
                    }
                    </div>
                </div>
                `;

                await resend.emails.send({
                    from: 'Netic Intelligence <alerts@aifusionlabs.app>',
                    to: 'aifusionlabs@gmail.com',
                    subject: `[SESSION ALERT] ${leadData.company_name} - ${leadData.lead_name}`,
                    html: internalBodyHtml
                });
                console.log('✅ [Webhook] Sent "Internal Alert" email to Team.');

            } else {
                console.error('❌ [Webhook] RESEND_API_KEY missing. Cannot send email.');
            }

            console.log('[Webhook] 🚀 Email Pipeline Complete!');


            // ============================================================================
            // NOVA FIX #5: ALWAYS LOG TO SHEETS (Combined Fallback Logic)
            // ============================================================================
            const sheets = getSheetsClient();
            if (sheets && process.env.GOOGLE_SHEET_ID) {
                try {
                    console.log('[Webhook] SAVING TO GOOGLE SHEETS...');

                    // Fallback to "Unknown" if no leadData exists
                    const finalLeadData: any = leadData || {
                        lead_name: 'Unknown (Short/Failed)',
                        role: 'N/A',
                        company_name: 'N/A',
                        lead_email: 'N/A',
                        lead_phone: 'N/A',
                        budget_range: 'N/A',
                        timeline: 'N/A',
                        pain_points: [],
                        buying_committee: [],
                        vertical: 'N/A',
                        teamSize: 'N/A',
                        geography: 'N/A',
                        currentSystems: 'N/A',
                        salesPlan: `Transcript Length: ${transcriptText.length} chars.`,
                        tavusRecordingUrl: tavusRecordingUrl || ''
                    };

                    // explicit override if needed
                    if (!leadData && tavusRecordingUrl) {
                        finalLeadData.tavusRecordingUrl = tavusRecordingUrl;
                    } else if (leadData && tavusRecordingUrl) {
                        finalLeadData.tavusRecordingUrl = tavusRecordingUrl;
                    }

                    const values = [[
                        new Date().toISOString(),
                        finalLeadData.lead_name || 'Not Provided',
                        finalLeadData.role || 'Not Provided',
                        finalLeadData.company_name || 'Not Provided',
                        finalLeadData.lead_email || 'Not Provided',
                        finalLeadData.lead_phone || 'Not Provided',
                        finalLeadData.budget_range || 'Not Provided',
                        finalLeadData.timeline || 'Not Provided',
                        Array.isArray(finalLeadData.pain_points) ? finalLeadData.pain_points.join(', ') : (finalLeadData.pain_points || ''),
                        Array.isArray(finalLeadData.buying_committee) ? finalLeadData.buying_committee.join(', ') : (finalLeadData.buying_committee || ''),
                        finalLeadData.vertical || 'Field Service',
                        finalLeadData.teamSize || 'Not Provided',
                        finalLeadData.geography || 'Not Provided',
                        finalLeadData.currentSystems || 'Not Provided',
                        // Safe join for salesPlan (which might be array)
                        Array.isArray(finalLeadData.salesPlan) ? finalLeadData.salesPlan.join('\n') : (finalLeadData.salesPlan || ''),
                        finalLeadData.tavusRecordingUrl
                    ]];

                    await sheets.spreadsheets.values.append({
                        spreadsheetId: process.env.GOOGLE_SHEET_ID,
                        range: 'Sheet1!A:Q',
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values },
                    });
                    console.log('✅ [Webhook] Saved row to Google Sheets');
                } catch (sheetError: any) {
                    console.error('❌ [Webhook] Google Sheets Error:', sheetError.message);
                }
            }

            // ============================================================================
            // SALESFORCE DUAL-WRITE (Optional - Controlled by SALESFORCE_ENABLED env var)
            // ============================================================================
            if (process.env.SALESFORCE_ENABLED === 'true' && leadData && leadData.lead_name) {
                try {
                    console.log('[Webhook] 🔗 Syncing Lead to Salesforce...');
                    const sfService = new SalesforceService();
                    const sfLeadId = await sfService.createLead(leadData);
                    console.log('✅ [Webhook] Salesforce Lead created:', sfLeadId);
                } catch (sfError: any) {
                    console.error('❌ [Webhook] Salesforce Error:', sfError.message);
                    // Non-blocking: Don't fail the webhook if Salesforce fails
                }
            }

            console.log('[Webhook] 🚀 Hot Lead Pipeline Complete!');

            return NextResponse.json({ message: 'Event processed' });

        }

        // ============================================================================
        // FALLBACK: Handle any other event types gracefully
        // ============================================================================
        console.log(`[Webhook] Ignoring unhandled event type: ${eventType} `);
        return NextResponse.json({ message: `Event ${eventType} acknowledged but not processed` });

    } catch (error: any) {
        console.error('Error processing webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
