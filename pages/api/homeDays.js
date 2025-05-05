// pages/api/homeDays.js
import { google } from 'googleapis';
import { addDays, format, parseISO } from 'date-fns';

const TIME_ZONE = 'America/Chicago'; // Change if needed
const CALENDAR_ID = 'l.campbell0082@gmail.com'; // Replace with your flight calendar ID

const auth = new google.auth.GoogleAuth({
  credentials: require('../../../service-account.json'),
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
});

export default async function handler(req, res) {
  const calendar = google.calendar({ version: 'v3', auth: await auth.getClient() });

  const now = new Date();
  const end = addDays(now, 30);

  try {
    const result = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: TIME_ZONE,
    });

    const events = result.data.items || [];

    // Build map of days → earliest arrival time
    const arrivalMap = {};

    for (const event of events) {
      const start = event.start?.dateTime;
      const endTime = event.end?.dateTime;
      if (!endTime) continue;

      const day = format(parseISO(endTime), 'yyyy-MM-dd');
      const hour = parseISO(endTime).getHours();

      if (!arrivalMap[day] || hour < arrivalMap[day]) {
        arrivalMap[day] = hour;
      }
    }

    // Mark days with arrival before 15:00 as home days
    const homeDays = [];
    for (let i = 0; i < 30; i++) {
      const day = format(addDays(now, i), 'yyyy-MM-dd');
      const isHome = arrivalMap[day] !== undefined && arrivalMap[day] < 15;
      homeDays.push({ date: day, isHome });
    }

    res.status(200).json(homeDays);
  } catch (err) {
    console.error('Google Calendar API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
}
