// Tiny progressive enhancements. All content and navigation work without JS.
(function () {
  "use strict";
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  } catch (_) {}
  function current() { return root.getAttribute("data-theme") || (media.matches ? "dark" : "light"); }
  document.addEventListener("DOMContentLoaded", function () {
    var button = document.getElementById("themeToggle");
    function label() {
      if (!button) return;
      var dark = current() === "dark";
      button.textContent = dark ? "Day shift" : "Night shift";
      button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    }
    if (button) {
      button.hidden = false;
      label();
      button.addEventListener("click", function () {
        var next = current() === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem("theme", next); } catch (_) {}
        label();
      });
      media.addEventListener("change", label);
    }
    var forbidden = document.getElementById("doNotPress");
    var message = document.getElementById("robotMessage");
    if (forbidden && message) {
      var reports = [
        "You are now head of engineering. The previous head has rolled under a desk.",
        "The ship runs on curiosity. Unfortunately, curiosity is not tax-deductible.",
        "All systems nominal. We have lowered the definition of nominal.",
        "Your complaint has been forwarded to the void. The void is experiencing high call volume."
      ];
      var nextReport = 0;
      forbidden.hidden = false;
      forbidden.addEventListener("click", function () {
        message.textContent = "Ship’s computer: " + reports[nextReport++ % reports.length];
      });
    }
  });
})();
