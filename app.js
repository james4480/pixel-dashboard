(() => {
  "use strict";

  const cfg = window.DASHBOARD_CONFIG;
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date");
  const weatherEl = document.getElementById("weather");
  const eventsEl = document.getElementById("events");
  const statusEl = document.getElementById("status");

  let sunrise = null;
  let sunset = null;

  document.documentElement.style.setProperty("--night-opacity", cfg.nightOpacity);

  function ordinal(n) {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    return `${n}${{1: "st", 2: "nd", 3: "rd"}[n % 10] || "th"}`;
  }

  function updateClock() {
    const now = new Date();

    clockEl.textContent = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !cfg.use24HourClock,
      timeZone: cfg.timezone
    }).format(now);

    const parts = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: cfg.timezone
    }).formatToParts(now);

    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    dateEl.textContent = `${values.weekday} ${ordinal(Number(values.day))} ${values.month}`;

    updateNightMode(now);
  }

  function updateNightMode(now) {
    if (!sunrise || !sunset) return;

    const nightStart = new Date(sunset.getTime() + cfg.nightStartsMinutesAfterSunset * 60000);
    const dayStart = new Date(sunrise.getTime() + cfg.dayStartsMinutesAfterSunrise * 60000);
    const isNight = now < dayStart || now >= nightStart;
    document.body.classList.toggle("night", isNight);
  }

  async function loadWeather() {
    const unit = cfg.temperatureUnit === "fahrenheit" ? "fahrenheit" : "celsius";
    const symbol = unit === "fahrenheit" ? "°F" : "°C";

    const params = new URLSearchParams({
      latitude: cfg.latitude,
      longitude: cfg.longitude,
      daily: "temperature_2m_max,temperature_2m_min,sunrise,sunset",
      temperature_unit: unit,
      timezone: cfg.timezone,
      forecast_days: "2"
    });

    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
      const data = await response.json();

      weatherEl.textContent =
        `High ${Math.round(data.daily.temperature_2m_max[0])}${symbol}  ·  ` +
        `Low ${Math.round(data.daily.temperature_2m_min[0])}${symbol}`;

      sunrise = new Date(data.daily.sunrise[0]);
      sunset = new Date(data.daily.sunset[0]);
      updateNightMode(new Date());
    } catch (error) {
      console.error(error);
      weatherEl.textContent = "Weather unavailable";
    }
  }

  function dayKey(date) {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit",
      timeZone: cfg.timezone
    }).format(date);
  }

  function dayHeading(date) {
    const today = dayKey(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = dayKey(tomorrowDate);
    const key = dayKey(date);

    if (key === today) return "Today";
    if (key === tomorrow) return "Tomorrow";

    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: cfg.timezone
    }).format(date);
  }

  function eventTime(event) {
    if (event.allDay) return "All day";
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
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    }

    eventsEl.replaceChildren();

    for (const group of groups.values()) {
      const wrapper = document.createElement("section");
      wrapper.className = "day-group";

      const heading = document.createElement("div");
      heading.className = "day-label";
      heading.textContent = dayHeading(new Date(group[0].start));
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

      eventsEl.appendChild(wrapper);
    }
  }

  async function loadCalendar() {
    if (!cfg.calendarEndpoint || cfg.calendarEndpoint.includes("PASTE_")) {
      eventsEl.innerHTML = '<div class="error">Add your Apps Script URL in config.js</div>';
      return;
    }

    try {
      const separator = cfg.calendarEndpoint.includes("?") ? "&" : "?";
      const response = await fetch(`${cfg.calendarEndpoint}${separator}t=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Calendar HTTP ${response.status}`);
      const data = await response.json();
      renderEvents(data.events || []);
      statusEl.textContent = `Updated ${new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}`;
    } catch (error) {
      console.error(error);
      eventsEl.innerHTML = '<div class="error">Calendar unavailable</div>';
    }
  }

  function shiftPixels() {
    const odd = Math.floor(Date.now() / 300000) % 2;
    document.body.classList.toggle("shift-a", odd === 0);
    document.body.classList.toggle("shift-b", odd === 1);
  }

  updateClock();
  shiftPixels();
  loadWeather();
  loadCalendar();

  setInterval(updateClock, 1000);
  setInterval(shiftPixels, 60000);
  setInterval(loadCalendar, 5 * 60000);
  setInterval(loadWeather, 60 * 60000);
  setInterval(() => location.reload(), 24 * 60 * 60 * 1000);
})();
