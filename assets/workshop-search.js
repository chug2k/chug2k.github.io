(() => {
  "use strict";

  const form = document.querySelector(".project-search");
  const input = form.querySelector("input");
  const clear = form.querySelector("button");
  const status = form.querySelector('[role="status"]');
  const sections = document.querySelectorAll("[data-project-group]");
  const bench = document.querySelector(".bench");

  function fold(text) {
    return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  }

  // Index the rendered catalog so new cards and edits are immediately searchable.
  const projects = Array.from(document.querySelectorAll("[data-project-group] article"), card => ({
    card, text: fold(card.innerText)
  }));

  function filter() {
    const terms = fold(input.value).match(/[\p{L}\p{N}]+/gu) || [];
    let count = 0;
    for (const { card, text } of projects) {
      card.hidden = !terms.every(term => text.includes(term));
      if (!card.hidden) count++;
    }
    for (const section of sections) {
      section.hidden = !section.querySelector("article:not([hidden])");
    }
    bench.hidden = terms.length > 0;
    clear.hidden = !input.value;
    if (terms.length === 0) {
      status.textContent = count + " published " + (count === 1 ? "project" : "projects");
    } else if (count) {
      status.textContent = count + (count === 1 ? " project found" : " projects found");
    } else {
      status.textContent = "No projects found. Try fewer words or clear the search.";
    }
  }

  function restore() {
    input.value = new URLSearchParams(location.hash.slice(1)).get("q") || "";
    filter();
  }

  // Keep a result link shareable and preserve the visitor's place on Back.
  function update() {
    filter();
    const url = new URL(location.href);
    const query = input.value.trim();
    if (query) url.hash = new URLSearchParams({ q: query }).toString();
    else if (new URLSearchParams(url.hash.slice(1)).has("q")) url.hash = "";
    if (url.href !== location.href) history.replaceState(history.state, "", url);
  }

  input.addEventListener("input", update);
  clear.addEventListener("click", () => {
    input.value = "";
    update();
    input.focus();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    document.querySelector("[data-project-group] article:not([hidden]) a")?.focus();
  });
  window.addEventListener("hashchange", restore);
  window.addEventListener("pageshow", restore);
  restore();
  form.hidden = false;
})();
