const refs = {
  trackList: document.getElementById("track-list"),
  playlistList: document.getElementById("playlist-list"),
  shareList: document.getElementById("share-list"),
  uploadForm: document.getElementById("upload-form"),
  fileInput: document.getElementById("file-input"),
  playlistForm: document.getElementById("playlist-form"),
  playlistName: document.getElementById("playlist-name"),
  trackSearch: document.getElementById("track-search"),
  player: document.getElementById("player"),
  nowPlaying: document.getElementById("now-playing"),
  toast: document.getElementById("toast"),
  statTracks: document.getElementById("stat-tracks"),
  statPlaylists: document.getElementById("stat-playlists"),
  statShares: document.getElementById("stat-shares"),
  statStorage: document.getElementById("stat-storage"),
  authPanel: document.getElementById("auth-panel"),
  authStatus: document.getElementById("auth-status"),
  authHint: document.getElementById("auth-hint"),
  authMessage: document.getElementById("auth-message"),
  registerCard: document.getElementById("register-card"),
  loginCard: document.getElementById("login-card"),
  registerForm: document.getElementById("register-form"),
  loginForm: document.getElementById("login-form"),
  logoutBtn: document.getElementById("logout-btn"),
  registerName: document.getElementById("register-name"),
  registerEmail: document.getElementById("register-email"),
  registerPassword: document.getElementById("register-password"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password")
};

const state = {
  tracks: [],
  playlists: [],
  shares: [],
  search: "",
  shareToken: null,
  accessToken: localStorage.getItem("mymuse_access_token"),
  user: null,
  ownerExists: false
};

const getShareTokenFromPath = () => {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if ((parts[0] === "s" || parts[0] === "invite") && parts[1]) {
    return parts[1];
  }
  return null;
};

const showToast = (message) => {
  refs.toast.textContent = message;
  refs.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => refs.toast.classList.add("hidden"), 2500);
};

const setAuthMessage = (message, type = "ok") => {
  if (!message) {
    refs.authMessage.classList.add("hidden");
    refs.authMessage.classList.remove("ok", "error");
    refs.authMessage.textContent = "";
    return;
  }
  refs.authMessage.textContent = message;
  refs.authMessage.classList.remove("hidden", "ok", "error");
  refs.authMessage.classList.add(type);
};

const authHeaders = () =>
  state.accessToken
    ? {
        Authorization: `Bearer ${state.accessToken}`
      }
    : {};

const api = async (url, options = {}) => {
  const merged = {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders()
    }
  };
  const response = await fetch(url, merged);
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.message || parsed.error || text;
    } catch {}
    throw new Error(message || `Request failed (${response.status})`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
};

const setAccessToken = (token) => {
  state.accessToken = token;
  if (token) {
    localStorage.setItem("mymuse_access_token", token);
  } else {
    localStorage.removeItem("mymuse_access_token");
  }
};

const setAuthState = (user) => {
  state.user = user;
  refs.authStatus.textContent = user
    ? `Вошли как ${user.name} (${user.role})`
    : "Не авторизован.";
  refs.logoutBtn.style.display = user ? "inline-flex" : "none";
};

const renderAuthMode = () => {
  const showRegister = !state.ownerExists && !state.user;
  const showLogin = state.ownerExists && !state.user;
  refs.registerCard.style.display = showRegister ? "" : "none";
  refs.loginCard.style.display = showLogin ? "" : "none";
};

const loadSetupState = async () => {
  const setup = await api("/auth/setup-state", { headers: {} });
  state.ownerExists = setup.ownerExists;
  if (setup.ownerExists) {
    refs.authHint.textContent = "Владелец уже создан. Войди через логин.";
  } else {
    refs.authHint.textContent = "Первый запуск: создай владельца.";
  }
  renderAuthMode();
};

const requireAuthUi = (enabled) => {
  const display = enabled ? "" : "none";
  document.getElementById("stats").style.display = display;
  document.getElementById("upload-panel").style.display = display;
  document.getElementById("library-grid").style.display = display;
  document.getElementById("share-panel").style.display = display;
  document.getElementById("player-panel").style.display = display;
};

const playTrack = (track) => {
  const source = state.shareToken
    ? `/api/shares/${state.shareToken}/stream`
    : `/api/tracks/${track.id}/stream`;
  refs.player.src = source;
  refs.nowPlaying.textContent = `Сейчас играет: ${track.title} - ${track.artist}`;
  refs.player.play().catch(() => undefined);
};

const currentTrackList = () => {
  const query = state.search.trim().toLowerCase();
  if (!query) {
    return state.tracks;
  }
  return state.tracks.filter((track) =>
    `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query)
  );
};

const renderStats = async () => {
  const payload = await api("/api/stats");
  refs.statTracks.textContent = String(payload.stats.tracks);
  refs.statPlaylists.textContent = String(payload.stats.playlists);
  refs.statShares.textContent = String(payload.stats.shares);
  refs.statStorage.textContent = `${(payload.stats.totalBytes / (1024 * 1024)).toFixed(2)} MB`;
};

const makePlaylistSelector = () => {
  const select = document.createElement("select");
  for (const playlist of state.playlists) {
    const option = document.createElement("option");
    option.value = playlist.id;
    option.textContent = playlist.name;
    select.appendChild(option);
  }
  return select;
};

const renderTracks = () => {
  refs.trackList.innerHTML = "";
  const filtered = currentTrackList();
  if (filtered.length === 0) {
    refs.trackList.innerHTML = '<li class="item"><div class="item-sub">Треки не найдены.</div></li>';
    return;
  }

  for (const track of filtered) {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="item-title">${track.title}</div>
      <div class="item-sub">${track.artist} - ${track.album}</div>
      <div class="actions"></div>
    `;

    const actions = li.querySelector(".actions");
    const playBtn = document.createElement("button");
    playBtn.textContent = "Слушать";
    playBtn.addEventListener("click", () => playTrack(track));
    actions.appendChild(playBtn);

    if (!state.shareToken) {
      const shareBtn = document.createElement("button");
      shareBtn.textContent = "Поделиться";
      shareBtn.className = "secondary";
      shareBtn.addEventListener("click", async () => {
        const result = await api("/api/shares", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "track", targetId: track.id, expiresInHours: 72 })
        });
        await loadPrivateData();
        window.prompt("Ссылка", result.url);
      });
      actions.appendChild(shareBtn);

      const editBtn = document.createElement("button");
      editBtn.textContent = "Изменить";
      editBtn.className = "secondary";
      editBtn.addEventListener("click", async () => {
        const title = window.prompt("Название", track.title);
        if (!title) return;
        const artist = window.prompt("Артист", track.artist);
        if (!artist) return;
        const album = window.prompt("Альбом", track.album);
        if (!album) return;
        await api(`/api/tracks/${track.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, artist, album })
        });
        await loadPrivateData();
      });
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Удалить";
      deleteBtn.className = "danger";
      deleteBtn.addEventListener("click", async () => {
        if (!window.confirm(`Удалить трек "${track.title}"?`)) return;
        await api(`/api/tracks/${track.id}`, { method: "DELETE" });
        await loadPrivateData();
      });
      actions.appendChild(deleteBtn);

      if (state.playlists.length > 0) {
        const select = makePlaylistSelector();
        const addBtn = document.createElement("button");
        addBtn.textContent = "В плейлист";
        addBtn.className = "secondary";
        addBtn.addEventListener("click", async () => {
          await api(`/api/playlists/${select.value}/tracks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trackId: track.id })
          });
          await loadPrivateData();
        });
        actions.appendChild(select);
        actions.appendChild(addBtn);
      }
    }

    refs.trackList.appendChild(li);
  }
};

const renderPlaylists = () => {
  refs.playlistList.innerHTML = "";
  if (state.shareToken) {
    refs.playlistList.innerHTML = "";
    return;
  }
  if (state.playlists.length === 0) {
    refs.playlistList.innerHTML = '<li class="item"><div class="item-sub">Плейлистов пока нет.</div></li>';
    return;
  }

  for (const playlist of state.playlists) {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="item-title">${playlist.name}</div>
      <div class="item-sub">${playlist.tracks.length} tracks</div>
      <div class="actions">
        <button class="secondary share-playlist" data-id="${playlist.id}">Поделиться плейлистом</button>
      </div>
    `;
    li.querySelector(".share-playlist").addEventListener("click", async () => {
      const result = await api("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "playlist", targetId: playlist.id, expiresInHours: 72 })
      });
      await loadPrivateData();
      window.prompt("Ссылка на плейлист", result.url);
    });
    refs.playlistList.appendChild(li);
  }
};

const renderShares = () => {
  refs.shareList.innerHTML = "";
  if (state.shareToken) {
    refs.shareList.innerHTML = "";
    return;
  }
  if (state.shares.length === 0) {
    refs.shareList.innerHTML = '<li class="item"><div class="item-sub">Активных ссылок нет.</div></li>';
    return;
  }
  for (const share of state.shares) {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="item-title">${share.type} - ${share.targetId}</div>
      <a class="share-url" href="${share.url}" target="_blank" rel="noreferrer">${share.url}</a>
      <div class="item-sub">Истекает: ${share.expiresAt || "никогда"}</div>
      <div class="actions">
        <button class="danger revoke-share">Revoke</button>
      </div>
    `;
    li.querySelector(".revoke-share").addEventListener("click", async () => {
      await api(`/api/shares/${share.token}`, { method: "DELETE" });
      await loadPrivateData();
      showToast("Ссылка отключена");
    });
    refs.shareList.appendChild(li);
  }
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
  renderTracks();
  renderPlaylists();
  renderShares();
};

const renderShareView = async (token) => {
  const data = await api(`/api/shares/${token}`, { headers: {} });
  state.shareToken = token;
  refs.authPanel.style.display = "none";
  refs.trackSearch.closest(".panel-header").style.display = "none";
  document.getElementById("stats").style.display = "none";
  document.getElementById("upload-panel").style.display = "none";
  document.querySelector("#library-grid article:nth-child(2)").style.display = "none";
  document.getElementById("share-panel").style.display = "none";
  if (data.track) {
    state.tracks = [data.track];
    state.playlists = [];
    renderTracks();
    playTrack(data.track);
    return;
  }
  if (data.playlist) {
    state.tracks = data.playlist.tracks;
    state.playlists = [data.playlist];
    renderTracks();
    renderPlaylists();
  }
};

refs.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthMessage("");
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
    setAuthMessage("Владелец успешно создан.", "ok");
    showToast("Успешно");
    requireAuthUi(true);
    state.ownerExists = true;
    await loadSetupState();
    await loadPrivateData();
  } catch (error) {
    setAuthMessage(`Ошибка регистрации: ${error.message}`, "error");
    showToast("Ошибка");
  }
});

refs.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthMessage("");
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
    setAuthMessage("Вход выполнен.", "ok");
    showToast("Успешно");
    requireAuthUi(true);
    await loadPrivateData();
  } catch (error) {
    setAuthMessage(`Ошибка входа: ${error.message}`, "error");
    showToast("Ошибка");
  }
});

refs.logoutBtn.addEventListener("click", () => {
  setAccessToken(null);
  setAuthState(null);
  state.tracks = [];
  state.playlists = [];
  state.shares = [];
  renderTracks();
  renderPlaylists();
  renderShares();
  requireAuthUi(false);
  renderAuthMode();
});

refs.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!refs.fileInput.files?.length) return;
  const formData = new FormData();
  formData.append("track", refs.fileInput.files[0]);
  await fetch("/api/tracks/upload", {
    method: "POST",
    headers: authHeaders(),
    body: formData
  });
  refs.uploadForm.reset();
  await loadPrivateData();
  showToast("Трек загружен");
});

refs.playlistForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!refs.playlistName.value.trim()) return;
  await api("/api/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: refs.playlistName.value.trim() })
  });
  refs.playlistForm.reset();
  await loadPrivateData();
});

refs.trackSearch.addEventListener("input", () => {
  state.search = refs.trackSearch.value;
  renderTracks();
});

const boot = async () => {
  await loadSetupState();
  const token = getShareTokenFromPath();
  if (window.location.pathname.startsWith("/s/")) {
    await renderShareView(token);
    return;
  }

  if (!state.accessToken) {
    setAuthState(null);
    requireAuthUi(false);
    renderAuthMode();
    return;
  }

  try {
    requireAuthUi(true);
    await loadPrivateData();
  } catch {
    setAccessToken(null);
    setAuthState(null);
    requireAuthUi(false);
    renderAuthMode();
  }
};

boot().catch((error) => showToast(`Boot error: ${error.message}`));
