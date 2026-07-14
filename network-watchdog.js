(() => {
  "use strict";

  const CHECK_INTERVAL_MS = 30 * 1000;
  const REQUEST_TIMEOUT_MS = 7000;

  const statusEl = document.getElementById("internet-status");
  const statusTextEl = document.getElementById("internet-status-text");

  let checkInProgress = false;

  function setStatus(status, text) {
    if (!statusEl || !statusTextEl) {
      return;
    }

    statusEl.classList.remove("online", "offline", "checking");
    statusEl.classList.add(status);

    statusTextEl.textContent = text;
    statusEl.title = text;
  }

  async function checkInternet() {
    if (checkInProgress) {
      return;
    }

    checkInProgress = true;
    setStatus("checking", "Checking");

    const controller = new AbortController();

    const timeout = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const checkUrl = new URL(
        "internet-check.txt",
        window.location.href
      );

      checkUrl.searchParams.set("timestamp", Date.now().toString());

      const response = await fetch(checkUrl.toString(), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Health check returned HTTP ${response.status}`);
      }

      const text = await response.text();

      if (text.trim() !== "online") {
        throw new Error("Unexpected health-check response");
      }

      setStatus("online", "Internet online");
    } catch (error) {
      console.warn("Internet check failed:", error);
      setStatus("offline", "Internet offline");
    } finally {
      window.clearTimeout(timeout);
      checkInProgress = false;
    }
  }

  window.addEventListener("online", () => {
    checkInternet();
  });

  window.addEventListener("offline", () => {
    setStatus("offline", "Internet offline");
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

  window.dashboardNetworkWatchdog = {
    check: checkInternet
  };
})();
