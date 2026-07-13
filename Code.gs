/**
 * Google Apps Script calendar endpoint.
 * Deploy this as a web app that executes as you.
 */

const CALENDAR_ID = "primary";
const DAYS_AHEAD = 7;

function doGet() {
  const now = new Date();
  const end = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  const events = calendar.getEvents(now, end)
    .filter(event => !event.isOwnedByMe() || event.getMyStatus() !== CalendarApp.GuestStatus.NO)
    .map(event => ({
      title: event.getTitle(),
      start: event.getStartTime().toISOString(),
      end: event.getEndTime().toISOString(),
      allDay: event.isAllDayEvent()
    }))
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  return ContentService
    .createTextOutput(JSON.stringify({ events }))
    .setMimeType(ContentService.MimeType.JSON);
}
