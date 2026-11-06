// Writing-room layout behaviour. Pure UI: this module never reads or writes
// drafts, storage, sign-in state, or publishing state, and it adds no handler
// that entry.js already owns.
//
//   import { initWriterLayout } from "./layout.js";
//   initWriterLayout(); // once, any time after the DOM exists; repeat calls are no-ops
//
// What it does
// - Sidebar (#drawer): docked on screens 60rem and wider (state kept in
//   localStorage "writer.sidebar"), a drawer below the top bar on narrower
//   screens. Sets html[data-layout="ready"] and html[data-sidebar="open|closed"].
// - #draftsBtn opens the sidebar before entry.js runs its own handler (capture
//   phase), so entry.js can still focus #draftSearch. On narrow screens a
//   second press closes the drawer.
// - #sidebarClose, the scrim, Escape, and Ctrl/Cmd+\ close or toggle it. In
//   drawer mode, choosing a draft, New article, Import, or any top-bar control
//   closes the drawer, and the covered document is inert while it is open.
// - Account: #accountMenu is a native disclosure (summary#connectBtn). This
//   module closes it on an outside press, Escape, or a choice such as Sign out.
//   Only one menu (details.menu-root) is open at a time; arrow keys move
//   through menu items.
// - Sets --keyboard-inset so the table and image bar stays above an on-screen
//   keyboard.
// - Mirrors: #status text into its title (the bar can truncate it), full draft
//   titles and Archive/Restore names into list tooltips, the future-date hint
//   on #dateProp, aria-pressed on the Desktop/Mobile preview buttons, and
//   html[data-scrolled] for the top-bar hairline.
//
// Returns window.writerLayout = { open(), close(), toggle(), sync(), state }.
// Call sync() after a draft is installed to refresh the date hint.

const STORE_KEY = "writer.sidebar";
const WIDE = "(min-width: 60rem)";

export function initWriterLayout() {
  if (window.writerLayout) return window.writerLayout;
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const drawer = $("drawer");
  const toggleButton = $("draftsBtn");
  if (!drawer || !toggleButton) return null;
  const collapseButton = $("sidebarClose");
  const search = $("draftSearch");
  const doc = document.querySelector("#sheet .doc");
  const scrim = document.querySelector(".scrim");
  const topbar = document.querySelector(".topbar");
  const account = $("accountMenu");
  const wide = matchMedia(WIDE);

  const stored = () => {
    try {
      return localStorage.getItem(STORE_KEY);
    } catch {
      return null;
    }
  };
  const store = (value) => {
    try {
      localStorage.setItem(STORE_KEY, value);
    } catch {}
  };
  const isDrawer = () => !wide.matches;
  let open = wide.matches ? stored() !== "closed" : false;

  function render() {
    root.dataset.sidebar = open ? "open" : "closed";
    for (const button of [toggleButton, collapseButton])
      button?.setAttribute("aria-expanded", String(open));
    if (doc) doc.inert = isDrawer() && open;
  }

  function setOpen(value, { focusSearch = false } = {}) {
    if (value === open) return;
    const focusInside = drawer.contains(document.activeElement);
    open = value;
    if (!isDrawer()) store(open ? "open" : "closed");
    render();
    if (open && focusSearch) search?.focus({ preventScroll: true });
    if (!open && focusInside) toggleButton.focus({ preventScroll: true });
  }

  // Capture phase: runs before entry.js's #draftsBtn handler. Closing hides the
  // drawer at once, so entry.js's focus call cannot land inside it.
  document.addEventListener(
    "click",
    (event) => {
      if (!event.target.closest?.("#draftsBtn")) return;
      setOpen(isDrawer() ? !open : true);
    },
    true,
  );
  collapseButton?.addEventListener("click", () => setOpen(false));
  scrim?.addEventListener("click", () => setOpen(false));
  drawer.addEventListener("click", (event) => {
    if (isDrawer() && open && event.target.closest?.(".draft-open, #newBtn, #importBtn"))
      setOpen(false);
  });
  topbar?.addEventListener("click", (event) => {
    if (isDrawer() && open && !event.target.closest?.("#draftsBtn")) setOpen(false);
  });
  wide.addEventListener("change", () => {
    open = wide.matches ? stored() !== "closed" : false;
    render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (account?.open) {
        account.open = false;
        account.querySelector(":scope > summary")?.focus({ preventScroll: true });
        event.preventDefault();
        return;
      }
      if (event.defaultPrevented || !isDrawer() || !open) return;
      if (document.querySelector("dialog[open], details.menu-root[open]")) return;
      if (event.target === search && search.value) return;
      setOpen(false);
      toggleButton.focus({ preventScroll: true });
      event.preventDefault();
      return;
    }
    const backslash = event.code === "Backslash" || event.key === "\\";
    if (backslash && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      setOpen(!open, { focusSearch: !open && isDrawer() });
    }
  });

  // Menus: one open at a time, links close their menu, arrows move focus.
  document.addEventListener(
    "toggle",
    (event) => {
      const menu = event.target;
      if (!(menu instanceof HTMLDetailsElement) || !menu.open || !menu.classList.contains("menu-root"))
        return;
      for (const other of document.querySelectorAll("details.menu-root[open]"))
        if (other !== menu) other.open = false;
    },
    true,
  );
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("details.menu-root .menu a");
    if (link) link.closest("details").open = false;
  });
  if (account) {
    document.addEventListener("pointerdown", (event) => {
      if (account.open && !account.contains(event.target)) account.open = false;
    });
    account.addEventListener("click", (event) => {
      if (event.target.closest(".menu button, .menu a")) account.open = false;
    });
  }
  // Keep the table and image bar above an on-screen keyboard.
  const viewport = window.visualViewport;
  if (viewport) {
    const keyboard = () =>
      root.style.setProperty(
        "--keyboard-inset",
        `${Math.max(0, Math.round(innerHeight - viewport.height - viewport.offsetTop))}px`,
      );
    viewport.addEventListener("resize", keyboard);
    viewport.addEventListener("scroll", keyboard);
    keyboard();
  }
  document.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    let menu = event.target.closest?.("details.menu-root");
    const controls = event.target.getAttribute?.("aria-controls");
    if (!menu && controls) menu = document.getElementById(controls);
    if (!menu?.matches("details.menu-root")) return;
    const opener = event.target === menu.querySelector(":scope > summary") || !!controls;
    if (opener && !["ArrowDown", "ArrowUp"].includes(event.key)) return;
    if (!menu.open) menu.open = true;
    const items = [...menu.querySelectorAll(".menu button, .menu a")].filter(
      (item) => !item.disabled && item.getClientRects().length,
    );
    if (!items.length) return;
    const index = items.indexOf(event.target);
    let next;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % items.length;
    else next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
    items[next].focus();
    event.preventDefault();
  });

  // Mirrors that keep truncated or icon-only text discoverable.
  const status = $("status");
  const syncStatus = () => {
    if (status) status.title = status.textContent.trim();
  };
  if (status)
    new MutationObserver(syncStatus).observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  const lists = [$("draftlist"), $("postlist")].filter(Boolean);
  const syncLists = () => {
    for (const list of lists)
      for (const item of list.querySelectorAll(":scope > li")) {
        const openButton = item.querySelector(".draft-open");
        if (openButton) openButton.title = openButton.firstChild?.textContent?.trim() || "";
        for (const action of item.querySelectorAll(":scope > button:not(.draft-open)"))
          action.title = action.textContent.trim();
      }
  };
  for (const list of lists) new MutationObserver(syncLists).observe(list, { childList: true });

  search?.addEventListener("input", () => {
    const section = $("draftsDrawer");
    if (section) section.open = true;
  });

  const date = $("date");
  const dateProp = $("dateProp");
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const syncDate = () => {
    if (date && dateProp) dateProp.toggleAttribute("data-future", !!date.value && date.value > today());
  };
  date?.addEventListener("input", syncDate);
  date?.addEventListener("change", syncDate);
  document.addEventListener("focusin", syncDate);

  const desktopPreview = $("desktopPreview");
  const mobilePreview = $("mobilePreview");
  const pressPreview = (desktop) => {
    desktopPreview?.setAttribute("aria-pressed", String(desktop));
    mobilePreview?.setAttribute("aria-pressed", String(!desktop));
  };
  desktopPreview?.addEventListener("click", () => pressPreview(true));
  mobilePreview?.addEventListener("click", () => pressPreview(false));

  let scrollQueued = false;
  addEventListener(
    "scroll",
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        root.toggleAttribute("data-scrolled", scrollY > 2);
      });
    },
    { passive: true },
  );

  const sync = () => {
    syncDate();
    syncStatus();
    syncLists();
  };
  root.dataset.layout = "ready";
  render();
  sync();
  const api = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    sync,
    get state() {
      return { open, mode: isDrawer() ? "drawer" : "docked" };
    },
  };
  window.writerLayout = api;
  return api;
}
