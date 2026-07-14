(() => {
  "use strict";

  const CHECK_INTERVAL_MS = 30 * 1000;
  const REQUEST_TIMEOUT_MS = 7000;

  /*
   * This endpoint returns a tiny response and permits browser requests.
   * The timestamp prevents cached responses from being reused.
   */
  const CHECK_URL = "https://www.google.com/generate_204";

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
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      /*
       * no-cors allows the connectivity test without needing to read
       * the remote response body. A successfully completed request
       * means the browser reached the external server.
       */
      await fetch(`${CHECK_URL}?t=${Date.now()}`, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal
      });

      setStatus("online", "Internet online");
    } catch (error) {
      console.warn("Internet watchdog check failed:", error);
      setStatus("offline", "Internet offline");
    } finally {
      clearTimeout(timeout);
      checkInProgress = false;
    }
  }

  window.addEventListener("online", checkInternet);

  window.addEventListener("offline", () => {
    setStatus("offline", "Internet offline");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkInternet();
    }
  });

  checkInternet();
  setInterval(checkInternet, CHECK_INTERVAL_MS);

  window.dashboardNetworkWatchdog = {
    check: checkInternet
  };
})();
