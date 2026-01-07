import { NextResponse } from 'next/server';
import { SARAH_SYSTEM_PROMPT } from '@/lib/sarah-prompt';


// Helper to clean greeting for TTS
function cleanGreetingForTTS(greeting: string): string {
  // 1. Collapse whitespace (newlines/spaces) -> single space
  greeting = greeting.replace(/\s+/g, ' ');

  // 2. Strip ellipsis (spoken as "dot dot dot")
  greeting = greeting.replace(/\.\.\./g, ',');

  // 3. Fix brand name
  greeting = greeting.replace(/Netic.ai/g, 'netic-eye'); // pronunciation fix if needed, or just "netic"
  greeting = greeting.replace(/netic.ai/g, 'netic-eye');

  // 4. Remove em-dashes
  greeting = greeting.replace(/—/g, ',');

  // 5. Trim final result
  return greeting.trim();
}

// Default KB Tags (Sarah / Netic)
const DEFAULT_KB_TAGS = [
  'sarah-netic-pricing',
  'sarah-netic-roi',
  'sarah-netic-competition',
  'sarah-netic-battle-cards',
  'sarah-netic-implementation',
  'sarah-netic-objections',
  'sarah-netic-problems-goals',
  'sarah-netic-integrations',
  'sarah-netic-case-studies',
  'sarah-netic-industry-pain',
  'sarah-netic-demo'
];

export async function POST(request: Request) {
  // Destructure body, but we will IGNORE persona_id from client to ensure security
  const { persona_id: _ignored, audio_only, memory_id, document_tags, custom_greeting, context_url, conversation_name, conversational_context, properties } = await request.json();

  // 1. Get Persona ID secure from server
  const serverPersonaId = process.env.TAVUS_PERSONA_ID;
  if (!serverPersonaId) {
    console.error('SERVER ERROR: TAVUS_PERSONA_ID not set in env');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

    // NOVA FIX: Dynamic Webhook URL Logic
    // 1. If PRODUCTION, Force the Public Domain (Most Reliable)
    // 2. If PREVIEW (or validation), use VERCEL_URL (Deployment Hash)
    let finalBaseUrl = baseUrl;

    if (process.env.VERCEL_ENV === 'production') {
      finalBaseUrl = 'https://sarah-netic.vercel.app'; // Proposed Production URL
    } else if (process.env.VERCEL_URL) {
      finalBaseUrl = `https://${process.env.VERCEL_URL}`;
    }

    const callbackUrl = finalBaseUrl ? `${finalBaseUrl}/api/webhook` : undefined;

    console.log('[Setup] 🔗 Webhook Callback URL set to:', callbackUrl);
    console.log('[Setup] 🏭 Environment:', process.env.VERCEL_ENV);
    console.log('[Setup] 🏠 Base URL:', finalBaseUrl);

    console.log('Creating conversation for Persona:', serverPersonaId);

    // Clean the greeting
    const rawGreeting = custom_greeting || "Hey! I'm Sarah, your Netic.ai guide. I'm here to answer questions, share ideas, or just talk through what you're working on. What brings you here today?";
    const cleanedGreeting = cleanGreetingForTTS(rawGreeting);

    // Merge default tags with any custom tags
    const finalTags = Array.from(new Set([...DEFAULT_KB_TAGS, ...(document_tags || [])]));

    const body: any = {
      persona_id: serverPersonaId, // Reverting to 'persona_id' as verified working in previous version
      custom_greeting: cleanedGreeting,
      conversation_name: conversation_name || "Sarah Netic",
      conversational_context: SARAH_SYSTEM_PROMPT,
      document_tags: finalTags,
      properties: {
        max_call_duration: 2700, // 45 Minutes
        enable_recording: true,
        participant_absent_timeout: 60, // 1 Minute
        participant_left_timeout: 60, // 1 Minute
        // Merge in client-provided properties (Identity, etc)
        ...(properties || {})
      },
      audio_only: audio_only,
      memory_id: memory_id,
      callback_url: callbackUrl,
    };

    const response = await fetch("https://tavusapi.com/v2/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.TAVUS_API_KEY || "",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Tavus API] Request Failed:', JSON.stringify(errorData, null, 2));
      // Handle various error formats from Tavus/Upstream
      const errorMessage = errorData.message || errorData.error || errorData.detail || JSON.stringify(errorData);
      return NextResponse.json({ error: `Tavus Error: ${errorMessage}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('[Tavus API] Conversation created:', data.conversation_id);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Tavus API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
