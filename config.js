// Edit these values before publishing.
window.DASHBOARD_CONFIG = {
  // Copy the /exec URL from your deployed Google Apps Script.
  calendarEndpoint: "PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE",

  // Your location. Example below is central Zurich.
  latitude: 47.3769,
  longitude: 8.5417,
  timezone: "Europe/Zurich",

  // "celsius" or "fahrenheit"
  temperatureUnit: "celsius",

  // true = 24-hour clock; false = 12-hour clock.
  use24HourClock: true,

  // Night text opacity. Try 0.06–0.16 on the Pixel.
  nightOpacity: 0.10,

  // Optional offsets relative to calculated sunset/sunrise.
  nightStartsMinutesAfterSunset: 0,
  dayStartsMinutesAfterSunrise: 0
};
