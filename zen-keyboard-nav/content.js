// Zen Keyboard Navigator — standalone WebExtension prototype.
// No external libraries, network requests, or browser-wide shortcuts.
(() => {
  "use strict";

  if (window.__zenKeyboardNavigatorLoaded) return;
  window.__zenKeyboardNavigatorLoaded = true;

  const CONFIG = Object.freeze({
    toggleCode: "F8",
    hintsCode: "KeyF",
    scrollFraction: 0.7,
    hintAlphabet: "ASDFGHJKLQWERTYUIOPZXCVBNM"
  });

  const isYouTube = /(^|\.)youtube\.com$/i.test(location.hostname);
  const state = {
    enabled: false,
    hintsOpen: false,
    hintNewTab: false,
    typed: "",
    hints: [],
    selected: null
  };

  const host = document.createElement("div");
  host.id = "zen-keyboard-nav-overlay";
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .badge { position: fixed; top: 14px; right: 18px; padding: 6px 10px;
      background: #173b46; color: #f3fbff; border: 1px solid #6bccdd;
      border-radius: 8px; font: 600 12px/1.4 system-ui, sans-serif;
      box-shadow: 0 3px 16px #0006; white-space: nowrap; }
    .focus { position: fixed; border: 3px solid #46d6ff; border-radius: 7px;
      background: #46d6ff16; outline: 1px solid #0b2233;
      box-shadow: 0 0 0 3px #0a172480, 0 0 18px #46d6ff90;
      box-sizing: border-box; }
    .hint { position: fixed; padding: 2px 5px; border-radius: 4px;
      border: 1px solid #3e2800; background: #fff3a0; color: #151515;
      font: 800 12px/1.25 ui-monospace, monospace;
      box-shadow: 0 1px 5px #0008; white-space: nowrap; }
    .hint.match { background: #50e0b9; }
  `;
  const badge = document.createElement("div");
  badge.className = "badge";
  badge.hidden = true;
  const focus = document.createElement("div");
  focus.className = "focus";
  focus.hidden = true;
  const hintLayer = document.createElement("div");
  shadow.append(style, focus, hintLayer, badge);
  (document.body || document.documentElement).append(host);

  function rectOf(element) {
    if (!element?.isConnected) return null;
    const r = element.getBoundingClientRect();
    if (r.width < 9 || r.height < 9) return null;
    if (r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return null;
    const styles = getComputedStyle(element);
    if (styles.display === "none" || styles.visibility === "hidden" || styles.visibility === "collapse") return null;
    return r;
  }

  function clickableElements() {
    // Prefer the YouTube thumbnail over duplicate title links for the same video.
    const selector = 'a[href], button:not(:disabled), [role="button"], [role="link"], summary, input[type="button"], input[type="submit"]';
    const seenVideoLinks = new Set();
    const elements = [...document.querySelectorAll(selector)];
    if (isYouTube) {
      elements.sort((a, b) => {
        const rank = (el) => (el.matches('a#thumbnail, a[href*="/watch?v="], a[href^="/shorts/"]') ? 0 : 1);
        return rank(a) - rank(b);
      });
    }
    return elements.filter((el) => {
      if (el.closest("#zen-keyboard-nav-overlay")) return false;
      if (!rectOf(el)) return false;
      if (isYouTube && el.tagName === "A") {
        const href = el.href;
        if (/(?:\/watch\?|\/shorts\/)/.test(href)) {
          if (seenVideoLinks.has(href)) return false;
          seenVideoLinks.add(href);
        }
      }
      return true;
    });
  }

  function navigationElements() {
    const all = clickableElements();
    if (!isYouTube) return all;
    const videos = all.filter((el) => el.matches('a[href*="/watch?v="], a[href*="/shorts/"]'));
    return videos.length ? videos : all;
  }

  function setBadge() {
    badge.hidden = !state.enabled;
    if (state.enabled) {
      badge.textContent = state.hintsOpen
        ? `HINTS ${state.typed || "·"}  |  Esc: отмена`
        : "KEY NAV  |  ↑↓←→: выбор  F: метки  F8: выход";
    }
  }

  function redrawFocus() {
    if (!state.enabled || state.hintsOpen || !state.selected) {
      focus.hidden = true;
      return;
    }
    const r = rectOf(state.selected);
    focus.hidden = !r;
    if (!r) return;
    focus.style.left = `${r.left}px`;
    focus.style.top = `${r.top}px`;
    focus.style.width = `${r.width}px`;
    focus.style.height = `${r.height}px`;
  }

  function setSelected(element) {
    state.selected = element;
    redrawFocus();
  }

  function closeHints() {
    state.hintsOpen = false;
    state.hints = [];
    state.typed = "";
    hintLayer.replaceChildren();
    redrawFocus();
    setBadge();
  }

  function toggle() {
    state.enabled = !state.enabled;
    closeHints();
    if (state.enabled) {
      state.selected = navigationElements()[0] || null;
    } else {
      state.selected = null;
    }
    redrawFocus();
    setBadge();
  }

  function hintCode(index, width) {
    const chars = CONFIG.hintAlphabet;
    const base = chars.length;
    let result = "";
    for (let i = 0; i < width; i++) {
      result = chars[index % base] + result;
      index = Math.floor(index / base);
    }
    return result;
  }

  function openHints(newTab = false) {
    const items = clickableElements();
    if (!items.length) return;
    state.hintsOpen = true;
    state.hintNewTab = newTab;
    state.typed = "";
    state.hints = [];
    const base = CONFIG.hintAlphabet.length;
    const width = Math.max(1, Math.ceil(Math.log(items.length) / Math.log(base)));
    for (let i = 0; i < items.length; i++) {
      const label = document.createElement("span");
      label.className = "hint";
      label.textContent = hintCode(i, width);
      hintLayer.append(label);
      state.hints.push({ element: items[i], code: label.textContent, label });
    }
    redrawHints();
    redrawFocus();
    setBadge();
  }

  function redrawHints() {
    if (!state.hintsOpen) return;
    for (const hint of state.hints) {
      const rect = rectOf(hint.element);
      const shown = !!rect && hint.code.startsWith(state.typed);
      hint.label.hidden = !shown;
      if (!shown) continue;
      hint.label.classList.toggle("match", !!state.typed);
      hint.label.style.left = `${Math.max(0, rect.left)}px`;
      hint.label.style.top = `${Math.max(0, rect.top)}px`;
    }
  }

  function activate(element, newTab) {
    if (!element?.isConnected) return;
    const anchor = element.closest("a[href]");
    if (newTab && anchor) {
      // A direct keydown-driven user gesture; browsers may still apply popup restrictions.
      window.open(anchor.href, "_blank", "noopener,noreferrer");
      return;
    }
    element.click();
  }

  function typeHint(letter) {
    state.typed += letter;
    const matches = state.hints.filter(({ code }) => code.startsWith(state.typed));
    if (!matches.length) {
      state.typed = "";
      redrawHints();
      setBadge();
      return;
    }
    const chosen = matches.find(({ code }) => code === state.typed);
    if (chosen) {
      const target = chosen.element;
      const newTab = state.hintNewTab;
      closeHints();
      state.selected = target;
      activate(target, newTab);
      return;
    }
    redrawHints();
    setBadge();
  }

  function selectFirst(elements) {
    const ordered = [...elements].sort((a, b) => {
      const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
      return x.top - y.top || x.left - y.left;
    });
    setSelected(ordered[0] || null);
  }

  function findInDirection(elements, current, direction) {
    const r = current.getBoundingClientRect();
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    let winner = null;
    let best = Infinity;
    for (const el of elements) {
      if (el === current) continue;
      const test = el.getBoundingClientRect();
      const dx = (test.left + test.right) / 2 - cx;
      const dy = (test.top + test.bottom) / 2 - cy;
      const vertical = direction === "up" || direction === "down";
      const primary = vertical ? dy : dx;
      const secondary = vertical ? dx : dy;
      if ((direction === "down" || direction === "right") ? primary <= 5 : primary >= -5) continue;
      const score = Math.abs(primary) + Math.abs(secondary) * 2.5;
      if (score < best) { best = score; winner = el; }
    }
    return winner;
  }

  function move(direction) {
    const available = navigationElements();
    if (!available.length) { setSelected(null); return; }
    if (!state.selected || !available.includes(state.selected)) {
      selectFirst(available);
      return;
    }
    const target = findInDirection(available, state.selected, direction);
    if (target) { setSelected(target); return; }
    const distance = (direction === "up" || direction === "down")
      ? innerHeight * CONFIG.scrollFraction : innerWidth * CONFIG.scrollFraction;
    window.scrollBy({
      top: direction === "down" ? distance : direction === "up" ? -distance : 0,
      left: direction === "right" ? distance : direction === "left" ? -distance : 0,
      behavior: "instant"
    });
    requestAnimationFrame(() => {
      const updated = navigationElements();
      if (updated.length) selectFirst(updated);
      else redrawFocus();
    });
  }

  function inEditable(target) {
    return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="searchbox"]');
  }

  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  document.addEventListener("keydown", (event) => {
    if (event.isComposing || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

    // The toggle works even when a text input is focused.
    if (event.code === CONFIG.toggleCode && !event.shiftKey) {
      consume(event);
      toggle();
      return;
    }
    if (!state.enabled || inEditable(event.target)) return;

    if (state.hintsOpen) {
      if (event.key === "Escape") { consume(event); closeHints(); return; }
      if (event.key === "Backspace") {
        consume(event);
        state.typed = state.typed.slice(0, -1);
        redrawHints(); setBadge();
        return;
      }
      if (/^Key[A-Z]$/.test(event.code)) {
        consume(event);
        const letter = event.code.substring(3);
        if (CONFIG.hintAlphabet.includes(letter)) typeHint(letter);
        return;
      }
      return;
    }

    if (event.key === "Escape") { consume(event); toggle(); return; }
    if (event.code === CONFIG.hintsCode) {
      consume(event);
      openHints(event.shiftKey);
      return;
    }
    const arrows = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    if (arrows[event.key]) { consume(event); move(arrows[event.key]); return; }
    if (event.key === "Enter" && state.selected) {
      consume(event);
      activate(state.selected, event.shiftKey);
    }
  }, true);

  let refreshScheduled = false;
  function refresh() {
    if (!state.enabled || refreshScheduled) return;
    refreshScheduled = true;
    requestAnimationFrame(() => {
      refreshScheduled = false;
      redrawFocus();
      redrawHints();
    });
  }
  window.addEventListener("scroll", refresh, { passive: true, capture: true });
  window.addEventListener("resize", refresh, { passive: true });
})();
