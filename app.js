(() => {
  "use strict";

  const cfg = window.DASHBOARD_CONFIG;

  const clockEl = document.getElementById("clock");
  const clockMainEl = document.getElementById("clock-main");
  const dateEl = document.getElementById("date");
  const temperatureRangeEl = document.getElementById("temperature-range");
  const weatherConditionEl = document.getElementById("weather-condition");
  const eventsEl = document.getElementById("events");
  const statusEl = document.getElementById("status");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  let sunrise = null;
  let sunset = null;
  let lastDisplayedMinute = null;
  let lastCalendarSuccess = null;
  let calendarRetryTimer = null;
  let calendarRetryAttempt = 0;
  let calendarRequestInFlight = false;


  function fitClockToAvailableWidth() {
    const panel = document.querySelector(".left-panel");
    if (!panel || !clockMainEl) return;

    clockMainEl.style.transform = "scaleX(1)";

    const availableWidth = panel.clientWidth;
    const renderedWidth = clockMainEl.scrollWidth;

    if (renderedWidth > availableWidth && renderedWidth > 0) {
      const scale = Math.max(0.72, availableWidth / renderedWidth);
      clockMainEl.style.transform = `scaleX(${scale})`;
    }
  }

  document.documentElement.style.setProperty(
    "--night-opacity",
    String(cfg.nightOpacity ?? 0.08)
  );

  function ordinal(number) {
    const mod100 = number % 100;

    if (mod100 >= 11 && mod100 <= 13) {
      return `${number}th`;
    }

    return `${number}${{ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th"}`;
  }

  function updateClock() {
    const now = new Date();

    const timeText = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !cfg.use24HourClock,
      timeZone: cfg.timezone
    }).format(now);

    if (timeText !== lastDisplayedMinute) {
      clockMainEl.textContent = timeText;
      lastDisplayedMinute = timeText;

      clockEl.classList.remove("tick");
      void clockEl.offsetWidth;
      clockEl.classList.add("tick");
      requestAnimationFrame(fitClockToAvailableWidth);
    }

    const parts = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: cfg.timezone
    }).formatToParts(now);

    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    dateEl.textContent = `${values.weekday} ${ordinal(Number(values.day))} ${values.month}`;

    updateNightMode(now);
  }

  function updateNightMode(now) {
    if (!sunrise || !sunset) {
      document.body.classList.remove("night");
      themeMeta?.setAttribute("content", "#fafafa");
      return;
    }

    const dayStart = new Date(
      sunrise.getTime() + (cfg.dayStartsMinutesAfterSunrise ?? 0) * 60000
    );

    const nightStart = new Date(
      sunset.getTime() + (cfg.nightStartsMinutesAfterSunset ?? 0) * 60000
    );

    const isNight = now < dayStart || now >= nightStart;

    document.body.classList.toggle("night", isNight);
    themeMeta?.setAttribute("content", isNight ? "#000000" : "#fafafa");
  }

  function weatherDescription(code) {
    const descriptions = {
      0: "Clear",
      1: "Mostly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Freezing fog",
      51: "Light drizzle",
      53: "Drizzle",
      55: "Heavy drizzle",
      56: "Light freezing drizzle",
      57: "Freezing drizzle",
      61: "Light rain",
      63: "Rain",
      65: "Heavy rain",
      66: "Light freezing rain",
      67: "Freezing rain",
      71: "Light snow",
      73: "Snow",
      75: "Heavy snow",
      77: "Snow grains",
      80: "Light showers",
      81: "Rain showers",
      82: "Heavy showers",
      85: "Light snow showers",
      86: "Heavy snow showers",
      95: "Thunderstorms",
      96: "Thunderstorms with hail",
      99: "Severe thunderstorms with hail"
    };

    return descriptions[code] || "Current conditions";
  }

  async function loadWeather() {
    const unit = cfg.temperatureUnit === "fahrenheit" ? "fahrenheit" : "celsius";
    const symbol = unit === "fahrenheit" ? "°F" : "°C";

    const params = new URLSearchParams({
      latitude: String(cfg.latitude),
      longitude: String(cfg.longitude),
      current: "weather_code",
      daily: "temperature_2m_max,temperature_2m_min,sunrise,sunset",
      temperature_unit: unit,
      timezone: cfg.timezone,
      timeformat: "unixtime",
      forecast_days: "2"
    });

    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Weather HTTP ${response.status}`);
      }

      const data = await response.json();
      const high = Math.round(data.daily.temperature_2m_max[0]);
      const low = Math.round(data.daily.temperature_2m_min[0]);

      temperatureRangeEl.textContent = `${high}${symbol} / ${low}${symbol}`;
      weatherConditionEl.textContent = weatherDescription(data.current.weather_code);

      sunrise = new Date(data.daily.sunrise[0] * 1000);
      sunset = new Date(data.daily.sunset[0] * 1000);

      updateNightMode(new Date());
    } catch (error) {
      console.error(error);
      temperatureRangeEl.textContent = "Weather unavailable";
      weatherConditionEl.textContent = "";
      sunrise = null;
      sunset = null;
      updateNightMode(new Date());
    }
  }

  function dayKey(date) {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: cfg.timezone
    }).format(date);
  }

  function dayHeading(date) {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const key = dayKey(date);

    if (key === dayKey(today)) {
      return "Today";
    }

    if (key === dayKey(tomorrow)) {
      return "Tomorrow";
    }

    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: cfg.timezone
    }).format(date);
  }

  function eventTime(event) {
    if (event.allDay) {
      return "All day";
    }

    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !cfg.use24HourClock,
      timeZone: cfg.timezone
    }).format(new Date(event.start));
  }

  function renderEvents(events) {
    if (!events.length) {
      eventsEl.innerHTML = '<div class="empty">No events in the next 7 days</div>';
      return;
    }

    const groups = new Map();

    for (const event of events) {
      const key = dayKey(new Date(event.start));

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(event);
    }

    const fragment = document.createDocumentFragment();

    for (const group of groups.values()) {
      const wrapper = document.createElement("section");
      wrapper.className = "day-group";

const heading = document.createElement("div");

const headingText = dayHeading(new Date(group[0].start));

heading.className = "day-label";

if (headingText === "Today") {
    heading.classList.add("today");
}

heading.textContent = headingText.toUpperCase();

wrapper.appendChild(heading);

      for (const item of group) {
        const row = document.createElement("div");
        row.className = "event";

        const time = document.createElement("div");
        time.className = "event-time";
        time.textContent = eventTime(item);

        const title = document.createElement("div");
        title.className = "event-title";
        title.textContent = item.title || "(Untitled event)";

        row.append(time, title);
        wrapper.appendChild(row);
      }

      fragment.appendChild(wrapper);
    }

    eventsEl.replaceChildren(fragment);
  }

  function formatLastUpdated(date) {
    if (!date) return "never";

    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: cfg.timezone
    }).format(date);
  }

  function showCalendarStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.add("visible");
    statusEl.classList.toggle("error", isError);
  }

  function hideCalendarStatus() {
    statusEl.textContent = "";
    statusEl.classList.remove("visible", "error");
  }

  function clearCalendarRetry() {
    if (calendarRetryTimer) {
      clearTimeout(calendarRetryTimer);
      calendarRetryTimer = null;
    }
  }

  function scheduleCalendarRetry() {
    clearCalendarRetry();

    const retryDelays = [15_000, 30_000, 60_000, 120_000, 300_000];
    const delay = retryDelays[Math.min(calendarRetryAttempt, retryDelays.length - 1)];
    calendarRetryAttempt += 1;

    calendarRetryTimer = setTimeout(() => {
      loadCalendar({ isRetry: true });
    }, delay);
  }

  async function loadCalendar(options = {}) {
    if (!cfg.calendarEndpoint || cfg.calendarEndpoint.includes("PASTE_")) {
      eventsEl.innerHTML =
        '<div class="error">Add your Apps Script URL in config.js</div>';
      showCalendarStatus("Calendar endpoint is not configured", true);
      return;
    }

    if (calendarRequestInFlight) {
      return;
    }

    calendarRequestInFlight = true;
    eventsEl.classList.add("refreshing");

    try {
      const separator = cfg.calendarEndpoint.includes("?") ? "&" : "?";
      const response = await fetch(
        `${cfg.calendarEndpoint}${separator}t=${Date.now()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`Calendar HTTP ${response.status}`);
      }

      const data = await response.json();
      renderEvents(data.events || []);

      lastCalendarSuccess = new Date();
      calendarRetryAttempt = 0;
      clearCalendarRetry();
      hideCalendarStatus();
    } catch (error) {
      console.error(error);

      const lastUpdatedText = formatLastUpdated(lastCalendarSuccess);
      showCalendarStatus(
        `Calendar update failed · Last updated ${lastUpdatedText}`,
        true
      );

      if (!options.isRetry || navigator.onLine) {
        scheduleCalendarRetry();
      }
    } finally {
      calendarRequestInFlight = false;
      window.setTimeout(() => eventsEl.classList.remove("refreshing"), 80);
    }
  }

  function shiftPixels() {
    const shiftIndex = Math.floor(Date.now() / (12 * 60 * 1000)) % 5;

    for (let index = 0; index < 5; index += 1) {
      document.body.classList.toggle(`shift-${index}`, index === shiftIndex);
    }
  }

  updateClock();
  fitClockToAvailableWidth();
  shiftPixels();
  loadWeather();
  loadCalendar();

  setInterval(updateClock, 1000);
  setInterval(shiftPixels, 60000);
  setInterval(loadCalendar, 60 * 1000);
  setInterval(loadWeather, 60 * 60 * 1000);
  window.addEventListener("resize", () => {
    requestAnimationFrame(fitClockToAvailableWidth);
  });

  window.addEventListener("orientationchange", () => {
    window.setTimeout(fitClockToAvailableWidth, 250);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      loadCalendar();
      loadWeather();
    }
  });

  window.addEventListener("online", () => {
    clearCalendarRetry();
    calendarRetryAttempt = 0;
    loadCalendar();
    loadWeather();
  });

  window.addEventListener("focus", () => {
    loadCalendar();
  });

  setInterval(() => window.location.reload(), 24 * 60 * 60 * 1000);
})();
