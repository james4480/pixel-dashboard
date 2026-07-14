(() => {
  "use strict";

  const quotes = [
    "Small steps every day add up to big results.",
    "Focus on progress, not perfection.",
    "The best way forward is to begin.",
    "Consistency creates confidence.",
    "Do something today your future self will thank you for.",
    "A calm mind makes better decisions.",
    "You do not have to see the whole path to take the next step.",
    "Make today useful.",
    "Great things are built one ordinary day at a time.",
    "Your direction matters more than your speed.",
    "Clarity comes from action.",
    "Keep going. You are closer than you think.",
    "A little progress is still progress.",
    "Choose what moves you forward.",
    "Make room for what matters."
  ];

  const intervalMs = 30 * 1000;
  const durationMs = 60 * 1000;
  let previousIndex = -1;
  let hideTimer;

  const style = document.createElement("style");
  style.textContent = `
    #quote-screensaver {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10vw;
      background: #bfe3f7;
      color: #36779b;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 800ms ease, visibility 800ms ease;
    }

    #quote-screensaver.visible {
      opacity: 1;
      visibility: visible;
    }

    #quote-screensaver blockquote {
      max-width: 80vw;
      margin: 0;
      text-align: center;
      font-family: "Inter", system-ui, sans-serif;
      font-size: clamp(2.2rem, 6vw, 5.5rem);
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.03em;
    }

    #quote-screensaver .quote-mark {
      opacity: 0.45;
    }
  `;

  const overlay = document.createElement("section");
  overlay.id = "quote-screensaver";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <blockquote>
      <span class="quote-mark">“</span>
      <span id="quote-screensaver-text"></span>
      <span class="quote-mark">”</span>
    </blockquote>
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  const quoteText = document.getElementById("quote-screensaver-text");

  function randomQuote() {
    let index;
    do {
      index = Math.floor(Math.random() * quotes.length);
    } while (quotes.length > 1 && index === previousIndex);
    previousIndex = index;
    return quotes[index];
  }

  function hideScreensaver() {
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
  }

  function showScreensaver() {
    quoteText.textContent = randomQuote();
    overlay.classList.add("visible");
    overlay.setAttribute("aria-hidden", "false");

    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideScreensaver, durationMs);
  }

  setInterval(showScreensaver, intervalMs);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      hideScreensaver();
    }
  });
})();
