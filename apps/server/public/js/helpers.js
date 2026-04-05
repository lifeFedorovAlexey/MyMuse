import { refs } from "./dom.js";

export const formatTime = (value) => {
  if (!Number.isFinite(value)) {
    return "0:00";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const showToast = (message) => {
  refs.toast.textContent = message;
  refs.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => refs.toast.classList.add("hidden"), 2800);
};

export const setStatusMessage = (element, message, type = "ok") => {
  if (!message) {
    element.textContent = "";
    element.classList.add("hidden");
    element.classList.remove("ok", "error");
    return;
  }
  element.textContent = message;
  element.classList.remove("hidden", "ok", "error");
  element.classList.add(type);
};

export const renderEmpty = (container, message) => {
  container.innerHTML = `<div class="empty-state">${message}</div>`;
};

export const getRoutePayload = () => {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if ((parts[0] === "s" || parts[0] === "invite") && parts[1]) {
    return { type: parts[0], token: parts[1] };
  }
  return null;
};
