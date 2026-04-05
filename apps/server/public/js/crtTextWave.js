const TEXT_SELECTOR = [
  ".monitor-title h2",
  ".section-heading h2",
  ".screen-focus-pane h2",
  ".hud-menu__title",
  ".hud-menu__label",
  ".hud-menu__value",
  ".left-menu__button",
  ".nav-link",
  ".section-kicker",
  ".player-kicker",
  ".soft-text",
  ".track-title",
  ".track-subtitle",
  ".playlist-subtitle",
  ".share-meta",
  ".empty-state",
  ".status-msg",
  ".player-meta strong",
  ".play-queue-copy strong",
  ".focus-meta-item strong",
  ".stat-card strong"
].join(", ");

const syncWaveText = (element) => {
  const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) {
    element.classList.remove("crt-wave-text");
    element.removeAttribute("data-wave-text");
    element.style.removeProperty("--crt-wave-delay");
    element.style.removeProperty("--crt-wave-duration");
    return;
  }

  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 10000;
  }

  const duration = 16 + (hash % 9);
  const delay = -((hash % 130) / 10);

  element.classList.add("crt-wave-text");
  element.setAttribute("data-wave-text", text);
  element.style.setProperty("--crt-wave-duration", `${duration}s`);
  element.style.setProperty("--crt-wave-delay", `${delay}s`);
};

const syncAllWaveText = (root) => {
  root.querySelectorAll(TEXT_SELECTOR).forEach(syncWaveText);
};

const syncMutationTarget = (target) => {
  if (!(target instanceof Element)) {
    const parent = target.parentElement;
    if (parent?.matches(TEXT_SELECTOR)) {
      syncWaveText(parent);
    }
    return;
  }

  if (target.matches(TEXT_SELECTOR)) {
    syncWaveText(target);
  }

  target.querySelectorAll?.(TEXT_SELECTOR).forEach(syncWaveText);
};

export const initCrtTextWave = () => {
  const frame = document.querySelector(".monitor-frame");
  if (!frame) {
    return;
  }

  syncAllWaveText(frame);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      syncMutationTarget(mutation.target);
      mutation.addedNodes.forEach(syncMutationTarget);
    }
  });

  observer.observe(frame, {
    characterData: true,
    childList: true,
    subtree: true
  });
};
