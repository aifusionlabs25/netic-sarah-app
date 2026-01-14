/**
 * ICS Calendar Invite Generator
 * Generates .ics file content for calendar invites
 */

interface CalendarEvent {
    title: string;
    description: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    organizerEmail: string;
    organizerName: string;
    attendeeEmail?: string;
    attendeeName?: string;
}

/**
 * Generate ICS file content for a calendar event
 */
export function generateICS(event: CalendarEvent): string {
    const formatDate = (date: Date): string => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const escapeText = (text: string): string => {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
    };

    const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@netic.ai`;

    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Netic//Sarah AI//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.startTime)}
DTEND:${formatDate(event.endTime)}
SUMMARY:${escapeText(event.title)}
DESCRIPTION:${escapeText(event.description)}
ORGANIZER;CN=${escapeText(event.organizerName)}:mailto:${event.organizerEmail}`;

    if (event.attendeeEmail) {
        ics += `
ATTENDEE;CN=${escapeText(event.attendeeName || event.attendeeEmail)};RSVP=TRUE:mailto:${event.attendeeEmail}`;
    }

    if (event.location) {
        ics += `
LOCATION:${escapeText(event.location)}`;
    }

    ics += `
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

    return ics;
}

/**
 * Parse meeting time strings from AI analysis into Date objects
 * Handles formats like:
 * - "Tuesday at 2pm"
 * - "January 15th at 10:00 AM"
 * - "Next Wednesday 3pm PT"
 */
export function parseMeetingTime(timeString: string, baseDate?: Date): Date | null {
    const now = baseDate || new Date();

    // Simple patterns - in production you'd use a library like chrono-node
    const dayMap: { [key: string]: number } = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
    };

    const lowerTime = timeString.toLowerCase();

    // Extract time (e.g., "2pm", "10:00 AM", "3:30pm")
    const timeMatch = lowerTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let hours = 14; // Default to 2pm
    let minutes = 0;

    if (timeMatch) {
        hours = parseInt(timeMatch[1]);
        minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        if (timeMatch[3]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (timeMatch[3]?.toLowerCase() === 'am' && hours === 12) hours = 0;
    }

    // Extract day of week
    for (const [dayName, dayNum] of Object.entries(dayMap)) {
        if (lowerTime.includes(dayName)) {
            const result = new Date(now);
            const currentDay = result.getDay();
            let daysUntil = dayNum - currentDay;
            if (daysUntil <= 0) daysUntil += 7; // Next week
            result.setDate(result.getDate() + daysUntil);
            result.setHours(hours, minutes, 0, 0);
            return result;
        }
    }

    // Handle "tomorrow"
    if (lowerTime.includes('tomorrow')) {
        const result = new Date(now);
        result.setDate(result.getDate() + 1);
        result.setHours(hours, minutes, 0, 0);
        return result;
    }

    // Default: next business day at the extracted time
    const result = new Date(now);
    result.setDate(result.getDate() + 1);
    // Skip weekends
    while (result.getDay() === 0 || result.getDay() === 6) {
        result.setDate(result.getDate() + 1);
    }
    result.setHours(hours, minutes, 0, 0);
    return result;
}

/**
 * Generate multiple ICS files for proposed meeting times
 */
export function generateMeetingOptions(
    proposedTimes: string[],
    attendeeEmail: string,
    attendeeName: string,
    companyName: string
): Array<{ time: string; date: Date; ics: string }> {
    const options: Array<{ time: string; date: Date; ics: string }> = [];

    for (const timeStr of proposedTimes) {
        const date = parseMeetingTime(timeStr);
        if (date) {
            const endDate = new Date(date);
            endDate.setMinutes(endDate.getMinutes() + 30); // 30 min meeting

            const ics = generateICS({
                title: `Netic Demo - ${companyName}`,
                description: `Discovery call with Sarah from Netic to explore how AI can transform your revenue operations.\n\nJoin us to discuss your specific needs and see the Netic platform in action.`,
                location: 'Video Call (link will be provided)',
                startTime: date,
                endTime: endDate,
                organizerEmail: 'sarah@netic.ai',
                organizerName: 'Sarah - Netic',
                attendeeEmail,
                attendeeName
            });

            options.push({
                time: timeStr,
                date,
                ics
            });
        }
    }

    return options;
}
