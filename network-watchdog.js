(() => {
  "use strict";

  const CHECK_INTERVAL_MS = 30 * 1000;
  const REQUEST_TIMEOUT_MS = 7000;

  const statusEl = document.getElementById("internet-status");
  const statusTextEl = document.getElementById("internet-status-text");

  let checkInProgress = false;
  let lastSuccessfulCheck = null;
  let lastStatus = "checking";

  function setStatus(status, text) {
    if (!statusEl || !statusTextEl) {
      return;
    }

    statusEl.classList.remove("online", "offline", "checking");
    statusEl.classList.add(status);

    statusTextEl.textContent = text;
    statusEl.title = text;
  }

  function ageString(date) {
    if (!date) {
      return null;
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000)
    );

    if (elapsedSeconds < 60) {
      return `${elapsedSeconds}s ago`;
    }

    const minutes = Math.floor(elapsedSeconds / 60);
    const remainingSeconds = elapsedSeconds % 60;

    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s ago`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m ago`;
  }

  function updateStatusText() {
    const age = ageString(lastSuccessfulCheck);

    if (lastStatus === "checking") {
      setStatus("checking", "Checking");
      return;
    }

    if (lastStatus === "online") {
      setStatus(
        "online",
        age
          ? `Internet online · ${age}`
          : "Internet online"
      );

      return;
    }

    if (lastStatus === "offline") {
      setStatus(
        "offline",
        age
          ? `Internet offline · last success ${age}`
          : "Internet offline · no successful check yet"
      );
    }
  }

  async function checkInternet() {
    if (checkInProgress) {
      return;
    }

    checkInProgress = true;
    lastStatus = "checking";
    updateStatusText();

    const controller = new AbortController();

    const timeout = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const checkUrl = new URL(
        "internet-check.txt",
        window.location.href
      );

      checkUrl.searchParams.set(
        "timestamp",
        Date.now().toString()
      );

      const response = await fetch(checkUrl.toString(), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(
          `Health check returned HTTP ${response.status}`
        );
      }

      const text = await response.text();

      if (text.trim() !== "online") {
        throw new Error(
          "Unexpected health-check response"
        );
      }

      lastSuccessfulCheck = new Date();
      lastStatus = "online";
      updateStatusText();
    } catch (error) {
      console.warn("Internet check failed:", error);

      lastStatus = "offline";
      updateStatusText();
    } finally {
      window.clearTimeout(timeout);
      checkInProgress = false;
    }
  }

  window.addEventListener("online", () => {
    checkInternet();
  });

  window.addEventListener("offline", () => {
    lastStatus = "offline";
    updateStatusText();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkInternet();
    }
  });

  checkInternet();

  window.setInterval(
    checkInternet,
    CHECK_INTERVAL_MS
  );

  window.setInterval(
    updateStatusText,
    1000
  );

  window.dashboardNetworkWatchdog = {
    check: checkInternet
  };
})();
