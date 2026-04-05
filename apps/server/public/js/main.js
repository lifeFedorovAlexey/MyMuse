import { api, authHeaders } from "./api.js";
import { initCrtTextWave } from "./crtTextWave.js";
import { refs } from "./dom.js";
import { getRoutePayload, setStatusMessage, showToast } from "./helpers.js";
import { initPlayerControls, playTrack, resetPlayer, syncPlayerMeta } from "./player.js";
import {
  setAppView,
  renderAuthMode,
  renderReferenceShell,
  renderPlayScreen,
  renderPlaylists,
  renderShares,
  renderTracks,
  setScreenMode,
  setAuthState,
  setWorkspaceVisibility,
  updateHero
} from "./render.js";
import { resetSessionState, setAccessToken, setCurrentTrack, state } from "./state.js";

initCrtTextWave();

const trackHandlers = {
  onAddToPlaylist: async (track, playlistId) => {
    await api(`/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: track.id })
    });
    await loadPrivateData();
    showToast("Трек добавлен в плейлист");
  },
  onShareTrack: async (track) => {
    const result = await api("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "track", targetId: track.id, expiresInHours: 72 })
    });
    await loadPrivateData();
    await navigator.clipboard.writeText(result.url).catch(() => undefined);
    showToast("Ссылка на трек создана");
  },
  onEditTrack: async (track) => {
    const title = window.prompt("Название", track.title);
    if (title === null) return;
    const artist = window.prompt("Артист", track.artist);
    if (artist === null) return;
    const album = window.prompt("Альбом", track.album);
    if (album === null) return;
    await api(`/api/tracks/${track.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), artist: artist.trim(), album: album.trim() })
    });
    await loadPrivateData();
    showToast("Метаданные обновлены");
  },
  onDeleteTrack: async (track) => {
    if (!window.confirm(`Удалить трек "${track.title}"?`)) {
      return;
    }
    await api(`/api/tracks/${track.id}`, { method: "DELETE" });
    if (state.currentTrack?.id === track.id) {
      resetPlayer();
    }
    await loadPrivateData();
    showToast("Трек удален");
  }
};

const playlistHandlers = {
  onSharePlaylist: async (playlist) => {
    const result = await api("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "playlist", targetId: playlist.id, expiresInHours: 72 })
    });
    await loadPrivateData();
    await navigator.clipboard.writeText(result.url).catch(() => undefined);
    showToast("Ссылка на плейлист создана");
  },
  onRemoveFromPlaylist: async (playlist, track) => {
    await api(`/api/playlists/${playlist.id}/tracks/${track.id}`, { method: "DELETE" });
    await loadPrivateData();
    showToast("Трек убран из плейлиста");
  }
};

const shareHandlers = {
  onCopyShare: async (share) => {
    await navigator.clipboard.writeText(share.url).catch(() => undefined);
    showToast("Ссылка скопирована");
  },
  onRevokeShare: async (share) => {
    await api(`/api/shares/${share.token}`, { method: "DELETE" });
    await loadPrivateData();
    showToast("Ссылка отключена");
  }
};

const renderTracksOnly = () => {
  syncPlayerMeta();
  renderPlayScreen();
  renderTracks(trackHandlers);
};

const renderAll = () => {
  renderPlayScreen();
  renderTracks(trackHandlers);
  renderPlaylists(playlistHandlers);
  renderShares(shareHandlers);
};

const renderStats = async () => {
  const payload = await api("/api/stats");
  refs.statTracks.textContent = String(payload.stats.tracks);
  refs.statPlaylists.textContent = String(payload.stats.playlists);
  refs.statShares.textContent = String(payload.stats.shares);
  refs.statStorage.textContent = `${(payload.stats.totalBytes / (1024 * 1024)).toFixed(2)} MB`;
};

const loadSetupState = async () => {
  const setup = await api("/auth/setup-state", { headers: {} });
  state.ownerExists = setup.ownerExists;
  refs.authHint.textContent = setup.ownerExists
    ? "Владелец уже создан. Используй логин."
    : "Первый запуск: создай владельца.";
  renderAuthMode();
};

const loadPrivateData = async () => {
  if (!state.accessToken) {
    return;
  }

  const [meResp, tracksResp, playlistsResp, sharesResp] = await Promise.all([
    api("/auth/me"),
    api("/api/tracks"),
    api("/api/playlists"),
    api("/api/shares")
  ]);

  setAuthState(meResp.user);
  state.tracks = tracksResp.tracks;
  state.playlists = playlistsResp.playlists;
  state.shares = sharesResp.shares;

  await renderStats();
  renderAll();
};

const applyShareMode = async (token) => {
  const data = await api(`/api/shares/${token}`, { headers: {} });
  state.shareToken = token;
  renderReferenceShell();

  setScreenMode("app");
  refs.trackSearchWrap.classList.add("hidden");
  setWorkspaceVisibility(true);

  if (data.track) {
    state.tracks = [data.track];
    state.playlists = [];
    renderAll();
    await playTrack(data.track);
  }

  if (data.playlist) {
    state.tracks = data.playlist.tracks;
    state.playlists = [data.playlist];
    renderAll();
    if (data.playlist.tracks[0]) {
      setCurrentTrack(data.playlist.tracks[0]);
      syncPlayerMeta();
    }
  }

  setAppView(data.playlist ? "lists" : "play");
  updateHero();
};

const applyInviteMode = (token) => {
  state.inviteToken = token;
  renderReferenceShell();
  setScreenMode("auth");
  refs.authPanel.classList.add("hidden");
  refs.invitePanel.classList.remove("hidden");
  setWorkspaceVisibility(false);
  updateHero();
};

refs.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatusMessage(refs.authMessage, "");
  try {
    const response = await api("/auth/register-owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: refs.registerName.value.trim(),
        email: refs.registerEmail.value.trim(),
        password: refs.registerPassword.value
      })
    });
    setAccessToken(response.accessToken);
    setAuthState(response.user);
    setScreenMode("app");
    setWorkspaceVisibility(true);
    setAppView("play");
    await loadSetupState();
    await loadPrivateData();
    setStatusMessage(refs.authMessage, "Владелец успешно создан.", "ok");
    showToast("Аккаунт создан");
  } catch (error) {
    setStatusMessage(refs.authMessage, `Ошибка регистрации: ${error.message}`, "error");
  }
});

refs.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatusMessage(refs.authMessage, "");
  try {
    const response = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: refs.loginEmail.value.trim(),
        password: refs.loginPassword.value
      })
    });
    setAccessToken(response.accessToken);
    setAuthState(response.user);
    setScreenMode("app");
    setWorkspaceVisibility(true);
    setAppView("play");
    await loadPrivateData();
    setStatusMessage(refs.authMessage, "Вход выполнен.", "ok");
    showToast("Вход выполнен");
  } catch (error) {
    setStatusMessage(refs.authMessage, `Ошибка входа: ${error.message}`, "error");
  }
});

refs.inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.inviteToken) {
    return;
  }

  setStatusMessage(refs.inviteMessage, "");
  try {
    const response = await api("/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: state.inviteToken,
        name: refs.inviteName.value.trim(),
        email: refs.inviteEmail.value.trim(),
        password: refs.invitePassword.value
      })
    });
    setAccessToken(response.accessToken);
    setAuthState(response.user);
    refs.invitePanel.classList.add("hidden");
    setScreenMode("app");
    setWorkspaceVisibility(true);
    setAppView("play");
    await loadPrivateData();
    setStatusMessage(refs.inviteMessage, "Приглашение принято, аккаунт готов.", "ok");
    showToast("Добро пожаловать");
    window.history.replaceState({}, "", "/");
  } catch (error) {
    setStatusMessage(refs.inviteMessage, `Ошибка: ${error.message}`, "error");
  }
});

refs.logoutBtn.addEventListener("click", () => {
  setAccessToken(null);
  resetSessionState();
  resetPlayer();
  renderReferenceShell();
  setScreenMode("auth");
  refs.authPanel.classList.remove("hidden");
  refs.invitePanel.classList.add("hidden");
  setWorkspaceVisibility(false);
  renderAuthMode();
  renderAll();
  updateHero();
});

refs.fileInput.addEventListener("change", () => {
  refs.selectedFileName.textContent = refs.fileInput.files?.[0]?.name || "Поддерживаются обычные аудиофайлы.";
});

refs.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!refs.fileInput.files?.length) {
    return;
  }

  const formData = new FormData();
  formData.append("track", refs.fileInput.files[0]);

  const response = await fetch("/api/tracks/upload", {
    method: "POST",
    headers: authHeaders(),
    body: formData
  });

  if (!response.ok) {
    showToast("Не удалось загрузить трек");
    return;
  }

  refs.uploadForm.reset();
  refs.selectedFileName.textContent = "Поддерживаются обычные аудиофайлы.";
  await loadPrivateData();
  showToast("Трек загружен");
});

refs.playlistForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = refs.playlistName.value.trim();
  if (!name) {
    return;
  }

  await api("/api/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });

  refs.playlistForm.reset();
  await loadPrivateData();
  showToast("Плейлист создан");
});

refs.trackSearch.addEventListener("input", () => {
  state.search = refs.trackSearch.value;
  window.cancelAnimationFrame(refs.trackSearch._rafId);
  refs.trackSearch._rafId = window.requestAnimationFrame(() => {
    renderTracksOnly();
  });
});

for (const link of refs.navLinks) {
  link.addEventListener("click", () => {
    setAppView(link.dataset.view || "play");
  });
}

initPlayerControls({
  onPlaybackStateChange: () => renderTracksOnly()
});

const boot = async () => {
  updateHero();
  renderReferenceShell();

  setScreenMode("auth");
  refs.authPanel.classList.remove("hidden");
  refs.invitePanel.classList.add("hidden");
  setAuthState(null);
  setWorkspaceVisibility(false);
  renderAuthMode();

  try {
    await loadSetupState();
  } catch (error) {
    state.ownerExists = true;
    refs.authHint.textContent = "Не удалось определить setup-state. Используй логин или перезагрузи страницу.";
    renderAuthMode();
    setStatusMessage(refs.authMessage, `Ошибка инициализации: ${error.message}`, "error");
  }

  const route = getRoutePayload();
  if (route?.type === "s") {
    await applyShareMode(route.token);
    return;
  }

  if (route?.type === "invite") {
    applyInviteMode(route.token);
    return;
  }

  if (!state.accessToken) {
    renderAll();
    return;
  }

  try {
    setScreenMode("app");
    setWorkspaceVisibility(true);
    setAppView("play");
    await loadPrivateData();
  } catch {
    setAccessToken(null);
    resetSessionState();
    setScreenMode("auth");
    setAuthState(null);
    setWorkspaceVisibility(false);
    renderAuthMode();
    renderAll();
  }
};

boot().catch((error) => {
  showToast(`Ошибка запуска: ${error.message}`);
});
