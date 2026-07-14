(() => {
  "use strict";

  const cfg = window.DASHBOARD_CONFIG || {};

  const RAIN_REFRESH_MS = 15 * 60 * 1000;
  const POLLEN_REFRESH_MS = 60 * 60 * 1000;
  const TRAIN_REFRESH_MS = 5 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 10 * 1000;

  const RAIN_PROBABILITY_THRESHOLD = 40;

  const ZUG_LATITUDE = 47.1662;
  const ZUG_LONGITUDE = 8.5155;

  const TRAIN_FROM = "Zug";
  const TRAIN_TO = "Zürich HB";

  let rainExpectedTime = null;
  let applyingWeatherText = false;

  function fetchWithTimeout(
    url,
    options = {},
    timeoutMs = REQUEST_TIMEOUT_MS
  ) {
    const controller = new AbortController();

    const timeout = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    return fetch(url, {
      ...options,
      signal: controller.signal
    }).finally(() => {
      window.clearTimeout(timeout);
    });
  }

  function localDayKey(date) {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: cfg.timezone || "Europe/Zurich"
    }).format(date);
  }

  function localTime(date) {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: cfg.timezone || "Europe/Zurich"
    }).format(date);
  }

  function installStyles() {
    if (document.getElementById("dashboard-extras-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "dashboard-extras-styles";

    style.textContent = `
      #pollen-status {
        margin-top: 0.35rem;
        color: var(--day-tertiary, #b5b5b5);
        font-size: 0.82em;
        font-weight: 500;
        line-height: 1.35;
      }

      #pollen-status.low {
        color: #52966a;
      }

      #pollen-status.medium {
        color: #b58a32;
      }

      #pollen-status.high {
        color: #c24f4f;
      }

      #train-status {
        margin-top: 2.4vh;
        padding-top: 1.7vh;
        border-top: 1px solid var(--day-divider, #e6e6e6);
        color: var(--day-secondary, #888);
        font-size: clamp(0.78rem, 1.25vw, 1.1rem);
        line-height: 1.35;
      }

      #train-status-label {
        margin-bottom: 0.3rem;
        color: var(--day-tertiary, #b5b5b5);
        font-size: 0.75em;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      #train-status-main {
        color: var(--day-secondary, #888);
        font-weight: 500;
      }

      #train-status-main strong {
        color: var(--day-foreground, #111);
        font-weight: 700;
      }

      #train-status-detail {
        margin-top: 0.2rem;
        color: var(--day-tertiary, #b5b5b5);
        font-size: 0.82em;
      }

      body.night #pollen-status,
      body.night #train-status {
        display: none;
      }
    `;

    document.head.appendChild(style);
  }

  function installElements() {
    const weatherEl = document.getElementById("weather");
    const leftPanel = document.querySelector(".left-panel");

    if (
      weatherEl &&
      !document.getElementById("pollen-status")
    ) {
      const pollen = document.createElement("div");

      pollen.id = "pollen-status";
      pollen.textContent = "Pollen: loading…";

      weatherEl.appendChild(pollen);
    }

    if (
      leftPanel &&
      !document.getElementById("train-status")
    ) {
      const train = document.createElement("section");

      train.id = "train-status";
      train.setAttribute("aria-live", "polite");

      train.innerHTML = `
        <div id="train-status-label">
          Zug → Zürich HB
        </div>

        <div id="train-status-main">
          Loading next train…
        </div>

        <div id="train-status-detail"></div>
      `;

      const internetStatus =
        document.getElementById("internet-status");

      if (
        internetStatus &&
        internetStatus.parentElement === leftPanel
      ) {
        leftPanel.insertBefore(
          train,
          internetStatus
        );
      } else {
        leftPanel.appendChild(train);
      }
    }
  }

  function cleanWeatherCondition(text) {
    return String(text || "")
      .replace(
        /\s*-\s*rain expected\s+\d{2}:\d{2}\s*$/i,
        ""
      )
      .trim();
  }

  function applyRainMessage() {
    const conditionEl =
      document.getElementById("weather-condition");

    if (!conditionEl) {
      return;
    }

    const baseCondition =
      cleanWeatherCondition(conditionEl.textContent);

    if (!baseCondition) {
      return;
    }

    const desiredText = rainExpectedTime
      ? `${baseCondition} - rain expected ${rainExpectedTime}`
      : baseCondition;

    if (conditionEl.textContent !== desiredText) {
      applyingWeatherText = true;
      conditionEl.textContent = desiredText;
      applyingWeatherText = false;
    }
  }

  function watchWeatherCondition() {
    const conditionEl =
      document.getElementById("weather-condition");

    if (!conditionEl) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (!applyingWeatherText) {
        window.requestAnimationFrame(
          applyRainMessage
        );
      }
    });

    observer.observe(conditionEl, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  async function loadRainForecast() {
    const latitude = Number(cfg.latitude);
    const longitude = Number(cfg.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      console.warn(
        "Rain forecast skipped: dashboard coordinates are invalid."
      );

      return;
    }

    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly:
        "precipitation_probability,precipitation,rain,showers",
      timezone:
        cfg.timezone || "Europe/Zurich",
      timeformat: "unixtime",
      forecast_days: "2"
    });

    try {
      const response = await fetchWithTimeout(
        `https://api.open-meteo.com/v1/forecast?${params}`,
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(
          `Rain forecast HTTP ${response.status}`
        );
      }

      const data = await response.json();

      const times =
        data.hourly?.time || [];

      const probabilities =
        data.hourly?.precipitation_probability || [];

      const precipitation =
        data.hourly?.precipitation || [];

      const rain =
        data.hourly?.rain || [];

      const showers =
        data.hourly?.showers || [];

      const now = new Date();
      const todayKey = localDayKey(now);

      let firstRain = null;

      for (
        let index = 0;
        index < times.length;
        index += 1
      ) {
        const forecastTime = new Date(
          Number(times[index]) * 1000
        );

        if (forecastTime <= now) {
          continue;
        }

        if (
          localDayKey(forecastTime) !==
          todayKey
        ) {
          continue;
        }

        const probability = Number(
          probabilities[index] ?? 0
        );

        const expectedAmount =
          Number(precipitation[index] ?? 0) +
          Number(rain[index] ?? 0) +
          Number(showers[index] ?? 0);

        if (
          probability >=
            RAIN_PROBABILITY_THRESHOLD &&
          expectedAmount > 0
        ) {
          firstRain = forecastTime;
          break;
        }
      }

      rainExpectedTime = firstRain
        ? localTime(firstRain)
        : null;

      applyRainMessage();
    } catch (error) {
      console.warn(
        "Could not update rain forecast:",
        error
      );
    }
  }

  function pollenLevel(value) {
    if (value < 10) {
      return "Low";
    }

    if (value < 50) {
      return "Medium";
    }

    return "High";
  }

  function applyPollenClass(element, level) {
    element.classList.remove(
      "low",
      "medium",
      "high"
    );

    element.classList.add(
      level.toLowerCase()
    );
  }

  async function loadPollen() {
    const pollenEl =
      document.getElementById("pollen-status");

    if (!pollenEl) {
      return;
    }

    const variables = [
      "alder_pollen",
      "birch_pollen",
      "grass_pollen",
      "mugwort_pollen",
      "ragweed_pollen"
    ];

    const params = new URLSearchParams({
      latitude: String(ZUG_LATITUDE),
      longitude: String(ZUG_LONGITUDE),
      hourly: variables.join(","),
      timezone:
        cfg.timezone || "Europe/Zurich",
      forecast_days: "2"
    });

    try {
      const response = await fetchWithTimeout(
        `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`,
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(
          `Pollen HTTP ${response.status}`
        );
      }

      const data = await response.json();
      const times = data.hourly?.time || [];

      if (!times.length) {
        throw new Error(
          "Pollen response contained no hourly times"
        );
      }

      const now = Date.now();

      let nearestIndex = 0;
      let nearestDifference =
        Number.POSITIVE_INFINITY;

      times.forEach((time, index) => {
        const timestamp =
          new Date(time).getTime();

        const difference =
          Math.abs(timestamp - now);

        if (
          difference <
          nearestDifference
        ) {
          nearestDifference = difference;
          nearestIndex = index;
        }
      });

      const values = variables.map(variable =>
        Math.max(
          0,
          Number(
            data.hourly?.[variable]?.[
              nearestIndex
            ] ?? 0
          )
        )
      );

      /*
       * The overall level is based on the highest current
       * concentration among the available pollen types.
       */
      const highestValue = Math.max(...values);
      const level = pollenLevel(highestValue);

      pollenEl.textContent =
        `Pollen: ${level}`;

      applyPollenClass(
        pollenEl,
        level
      );
    } catch (error) {
      console.warn(
        "Could not update pollen:",
        error
      );

      pollenEl.textContent =
        "Pollen: unavailable";

      pollenEl.classList.remove(
        "low",
        "medium",
        "high"
      );
    }
  }

  function normaliseTrainCode(value) {
    if (!value) {
      return "";
    }

    return String(value)
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/^S-BAHN/, "S")
      .replace(/^INTERREGIO/, "IR")
      .replace(/^INTERCITY/, "IC")
      .replace(/^REGIOEXPRESS/, "RE")
      .replace(/^REGIONAL/, "R");
  }

  function trainCode(connection) {
    const sections =
      Array.isArray(connection?.sections)
        ? connection.sections
        : [];

    for (const section of sections) {
      const journey = section?.journey;

      if (!journey) {
        continue;
      }

      const category =
        normaliseTrainCode(journey.category);

      const number =
        normaliseTrainCode(journey.number);

      /*
       * Examples:
       * category "IR", number "70" becomes "IR70".
       * category "S", number "24" becomes "S24".
       */
      if (category && number) {
        if (number.startsWith(category)) {
          return number;
        }

        return `${category}${number}`;
      }

      const name =
        normaliseTrainCode(journey.name);

      if (name) {
        const match = name.match(
          /\b(?:S|IR|IC|RE|EC|R|PE)\d+[A-Z]?\b/
        );

        if (match) {
          return match[0];
        }
      }
    }

    const products =
      Array.isArray(connection?.products)
        ? connection.products
        : [];

    for (const product of products) {
      const normalised =
        normaliseTrainCode(product);

      const match = normalised.match(
        /(?:S|IR|IC|RE|EC|R|PE)\d+[A-Z]?/
      );

      if (match) {
        return match[0];
      }
    }

    return "Train";
  }

  async function loadNextTrain() {
    const mainEl =
      document.getElementById(
        "train-status-main"
      );

    const detailEl =
      document.getElementById(
        "train-status-detail"
      );

    if (!mainEl || !detailEl) {
      return;
    }

    const params = new URLSearchParams({
      from: TRAIN_FROM,
      to: TRAIN_TO,
      limit: "1"
    });

    try {
      const response =
        await fetchWithTimeout(
          `https://transport.opendata.ch/v1/connections?${params}`,
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          `Train API HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      const connection =
        data.connections?.[0];

      if (!connection) {
        mainEl.textContent =
          "No upcoming connection found";

        detailEl.textContent = "";

        return;
      }

      const departureValue =
        connection.from?.prognosis
          ?.departure ||
        connection.from?.departure;

      const arrivalValue =
        connection.to?.prognosis
          ?.arrival ||
        connection.to?.arrival;

      const departure =
        departureValue
          ? localTime(
              new Date(departureValue)
            )
          : "--:--";

      const arrival =
        arrivalValue
          ? localTime(
              new Date(arrivalValue)
            )
          : null;

      const code =
        trainCode(connection);

      const delaySeconds = Number(
        connection.from?.delay ?? 0
      );

      const delayMinutes = Math.max(
        0,
        Math.round(delaySeconds / 60)
      );

      mainEl.innerHTML =
        `<strong>${departure}</strong> · ${code}`;

      const details = [];

      if (arrival) {
        details.push(
          `arrives ${arrival}`
        );
      }

      if (delayMinutes > 0) {
        details.push(
          `+${delayMinutes} min`
        );
      } else {
        details.push("on time");
      }

      detailEl.textContent =
        details.join(" · ");
    } catch (error) {
      console.warn(
        "Could not update next train:",
        error
      );

      mainEl.textContent =
        "Train information unavailable";

      detailEl.textContent = "";
    }
  }

  function refreshAll() {
    loadRainForecast();
    loadPollen();
    loadNextTrain();
  }

  installStyles();
  installElements();
  watchWeatherCondition();
  refreshAll();

  window.setInterval(
    loadRainForecast,
    RAIN_REFRESH_MS
  );

  window.setInterval(
    loadPollen,
    POLLEN_REFRESH_MS
  );

  window.setInterval(
    loadNextTrain,
    TRAIN_REFRESH_MS
  );

  window.addEventListener(
    "online",
    refreshAll
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refreshAll();
      }
    }
  );

  window.dashboardExtras = {
    refresh: refreshAll,
    refreshRain: loadRainForecast,
    refreshPollen: loadPollen,
    refreshTrain: loadNextTrain
  };
})();
