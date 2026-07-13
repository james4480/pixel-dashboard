// Edit these values before publishing.
window.DASHBOARD_CONFIG = {
  // Copy the /exec URL from your deployed Google Apps Script.
  calendarEndpoint: "https://script.google.com/macros/s/AKfycby8YUVvb7UgZBveSc2OJ4j3I77Ju27_T_6Ay0AXle9edYuka7SA_U7AMDOZsreXfBYy/exec",

  // Your location. Example below is central Zurich.
  latitude: 47.168,
  longitude: 8.517,
  timezone: "Europe/Zurich",

  // "celsius" or "fahrenheit"
  temperatureUnit: "celsius",

  // true = 24-hour clock; false = 12-hour clock.
  use24HourClock: true,

  // Night text opacity. Try 0.06–0.16 on the Pixel.
  nightOpacity: 0.1,

  // Optional offsets relative to calculated sunset/sunrise.
  nightStartsMinutesAfterSunset: 20,
  dayStartsMinutesAfterSunrise: 20
};
