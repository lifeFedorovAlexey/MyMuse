import { refs } from "./dom.js";
import { renderHudMenu } from "./components/hudMenu.js";
import { renderLeftMenu } from "./components/leftMenu.js";
import { renderEmpty } from "./helpers.js";
import { playTrack, syncPlayerMeta } from "./player.js";
import { state } from "./state.js";

const getHudMode = () => {
  if (state.shareToken) return "SHARED";
  if (state.user?.role === "owner") return "OWNER";
  if (state.user) return "USER";
  return state.inviteToken ? "INVITE" : "GUEST";
};

const getReferenceHudConfig = () => ({
  title: "MUSIC",
  stats: [
    { label: "SERVER", value: state.ownerExists ? "ONLINE" : "BOOT" },
    { label: "STREAM", value: "RANGE" },
    { label: "STORE", value: "LOCAL FS" },
    { label: "TRANSFER", value: state.shareToken ? "DIRECT" : "TRUSTED" }
  ]
});

const getReferenceLeftMenuConfig = () => {
  const activeView = state.shareToken && (state.appView === "access" || state.appView === "lists") ? "library" : state.appView;

  return {
    title: "Library",
    items: [
      { label: "Player", view: "play", active: activeView === "play", placeholder: false },
      { label: "Library", view: "library", active: activeView === "library", placeholder: false },
      { label: "Playlists", view: "lists", active: activeView === "lists", placeholder: Boolean(state.shareToken) },
      { label: "Shared", view: "access", active: activeView === "access", placeholder: Boolean(state.shareToken) }
    ]
  };
};

export const renderReferenceShell = () => {
  if (!refs.referenceShell) {
    return;
  }

  refs.referenceShell.innerHTML = `
    <div class="reference-layout">
      <div class="reference-layout__hud"></div>
      <div class="reference-layout__body">
        <div class="reference-layout__menu"></div>
        <div class="reference-layout__panel" aria-hidden="true"></div>
      </div>
    </div>
  `;

  renderHudMenu(refs.referenceShell.querySelector(".reference-layout__hud"), getReferenceHudConfig());
  const menuRoot = refs.referenceShell.querySelector(".reference-layout__menu");
  renderLeftMenu(menuRoot, getReferenceLeftMenuConfig());
  menuRoot.querySelectorAll(".left-menu__button[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.view;
      if (!nextView || button.disabled) {
        return;
      }
      setAppView(nextView);
    });
  });
};

export const updateHero = () => {
  if (state.shareToken) {
    refs.heroStatus.textContent = "Shared View";
    refs.heroSubtitle.textContent = "Публичный доступ открыт без административных панелей.";
    return;
  }

  if (state.user) {
    refs.heroStatus.textContent = state.user.name;
    refs.heroSubtitle.textContent =
      state.user.role === "owner"
        ? "Owner mode: библиотека, доступ и шаринг под контролем."
        : "User mode: приватный доступ к локальной музыкальной библиотеке.";
    return;
  }

  refs.heroStatus.textContent = "Idle";
  refs.heroSubtitle.textContent = "Авторизуйся или прими приглашение, чтобы открыть медиатеку.";
};

export const renderAuthMode = () => {
  const showRegister = !state.ownerExists && !state.user;
  const showLogin = state.ownerExists && !state.user;
  refs.registerCard.classList.toggle("hidden", !showRegister);
  refs.loginCard.classList.toggle("hidden", !showLogin);
};

export const setScreenMode = (mode) => {
  const showApp = mode === "app";
  refs.authShell.classList.toggle("hidden", showApp);
  refs.appShell.classList.toggle("hidden", !showApp);
  refs.appShell.classList.toggle("reference-phase", mode !== "app");
  renderReferenceShell();
};

export const setWorkspaceVisibility = (enabled) => {
  refs.workspace.classList.toggle("hidden", !enabled);
  refs.playerPanel.classList.toggle("hidden", !enabled);
  if (!enabled) {
    refs.stats.classList.add("hidden");
    refs.playSection.classList.add("hidden");
    refs.librarySection.classList.add("hidden");
    refs.listsSection.classList.add("hidden");
    refs.accessSection.classList.add("hidden");
    refs.workspace.dataset.view = "";
  }
};

export const setAppView = (view) => {
  state.appView = view;
  refs.workspace.dataset.view = view;
  refs.appShell.dataset.view = view;
  renderReferenceShell();

  refs.navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });

  if (state.shareToken) {
    const shareView = view === "lists" || view === "access" ? "library" : view;
    refs.stats.classList.add("hidden");
    refs.playSection.classList.toggle("hidden", shareView !== "play");
    refs.librarySection.classList.toggle("hidden", shareView !== "library");
    refs.listsSection.classList.toggle("hidden", shareView !== "lists");
    refs.accessSection.classList.toggle("hidden", true);
    refs.uploadCard.classList.add("hidden");
    refs.sharesCard.classList.add("hidden");
    return;
  }

  refs.stats.classList.toggle("hidden", view !== "access");
  refs.playSection.classList.toggle("hidden", view !== "play");
  refs.librarySection.classList.toggle("hidden", view !== "library");
  refs.listsSection.classList.toggle("hidden", view !== "lists");
  refs.accessSection.classList.toggle("hidden", view !== "access");
  refs.sharesCard.classList.toggle("hidden", false);
};

export const setAuthState = (user) => {
  state.user = user;
  refs.authStatus.textContent = user ? `Вошли как ${user.name} (${user.role})` : "Не авторизован.";
  refs.logoutBtn.classList.toggle("hidden", !user);
  updateHero();
  renderReferenceShell();
};

export const currentTrackList = () => {
  const query = state.search.trim().toLowerCase();
  if (!query) {
    return state.tracks;
  }
  return state.tracks.filter((track) =>
    `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query)
  );
};

const makePlaylistSelector = () => {
  const select = document.createElement("select");
  select.className = "track-inline-select";
  for (const playlist of state.playlists) {
    const option = document.createElement("option");
    option.value = playlist.id;
    option.textContent = playlist.name;
    select.appendChild(option);
  }
  return select;
};

export const renderPlayScreen = () => {
  refs.playScreenGlyph.textContent = "";
};

export const renderLibraryFocus = () => {
  const track = state.currentTrack || state.tracks[0];
  if (!track) {
    refs.libraryFocusTitle.textContent = "Ничего не выбрано";
    refs.libraryFocusSubtitle.textContent = "Открой трек, чтобы увидеть метаданные и начать воспроизведение.";
    refs.libraryFocusGlyph.textContent = "♪";
    refs.libraryFocusArtist.textContent = "Unknown artist";
    refs.libraryFocusAlbum.textContent = "Unknown album";
    return;
  }

  refs.libraryFocusTitle.textContent = track.title;
  refs.libraryFocusSubtitle.textContent = `${track.artist} • ${new Date(track.createdAt).toLocaleDateString("ru-RU")}`;
  refs.libraryFocusGlyph.textContent = track.title.slice(0, 1).toUpperCase();
  refs.libraryFocusArtist.textContent = track.artist;
  refs.libraryFocusAlbum.textContent = track.album;
};

export const renderListsFocus = () => {
  const playlist = state.playlists[0];
  refs.listsFocusCount.textContent = String(state.playlists.length);

  if (!playlist) {
    refs.listsFocusTitle.textContent = "Плейлистов пока нет";
    refs.listsFocusSubtitle.textContent = "Создай плейлист и начни собирать коллекции.";
    refs.listsFocusGlyph.textContent = "≡";
    refs.listsFocusTracks.textContent = "0";
    return;
  }

  refs.listsFocusTitle.textContent = playlist.name;
  refs.listsFocusSubtitle.textContent = `${playlist.tracks.length} треков в текущем списке.`;
  refs.listsFocusGlyph.textContent = playlist.name.slice(0, 1).toUpperCase();
  refs.listsFocusTracks.textContent = String(playlist.tracks.length);
};

export const renderTracks = ({ onAddToPlaylist, onShareTrack, onEditTrack, onDeleteTrack }) => {
  const tracks = currentTrackList();
  refs.trackList.innerHTML = "";
  renderLibraryFocus();

  if (tracks.length === 0) {
    renderEmpty(refs.trackList, state.search ? "По запросу ничего не найдено." : "Библиотека пока пуста.");
    return;
  }

  for (const track of tracks) {
    const card = document.createElement("article");
    card.className = "track-card";

    const main = document.createElement("div");
    main.className = "track-main";

    const head = document.createElement("div");
    head.className = "track-title-row";
    head.innerHTML = `
      <div>
        <div class="track-title">${track.title}</div>
        <div class="track-subtitle">${track.artist} • ${track.album}</div>
      </div>
      <div class="track-subtitle">${new Date(track.createdAt).toLocaleDateString("ru-RU")}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "track-actions";

    const playButton = document.createElement("button");
    playButton.textContent = state.currentTrack?.id === track.id && !refs.player.paused ? "Пауза" : "Play";
    playButton.addEventListener("click", async () => {
      if (state.currentTrack?.id === track.id && !refs.player.paused) {
        refs.player.pause();
      } else if (state.currentTrack?.id === track.id && refs.player.paused) {
        await refs.player.play();
      } else {
        await playTrack(track);
      }
      syncPlayerMeta();
      renderLibraryFocus();
      renderPlayScreen();
      renderTracks({ onAddToPlaylist, onShareTrack, onEditTrack, onDeleteTrack });
    });
    actions.appendChild(playButton);

    if (!state.shareToken) {
      const moreButton = document.createElement("button");
      moreButton.className = "ghost";
      moreButton.textContent = "More";

      const morePanel = document.createElement("div");
      morePanel.className = "track-more-actions hidden";

      if (state.playlists.length > 0) {
        const select = makePlaylistSelector();
        const addButton = document.createElement("button");
        addButton.className = "secondary";
        addButton.textContent = "Add to list";
        addButton.addEventListener("click", async () => onAddToPlaylist(track, select.value));
        morePanel.append(select, addButton);
      }

      const shareButton = document.createElement("button");
      shareButton.className = "secondary";
      shareButton.textContent = "Share";
      shareButton.addEventListener("click", async () => onShareTrack(track));
      morePanel.appendChild(shareButton);

      const editButton = document.createElement("button");
      editButton.className = "ghost";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", async () => onEditTrack(track));
      morePanel.appendChild(editButton);

      const deleteButton = document.createElement("button");
      deleteButton.className = "danger";
      deleteButton.textContent = "Drop";
      deleteButton.addEventListener("click", async () => onDeleteTrack(track));
      morePanel.appendChild(deleteButton);

      moreButton.addEventListener("click", () => {
        morePanel.classList.toggle("hidden");
      });

      actions.append(moreButton, morePanel);
    }

    main.append(head, actions);
    card.append(main);
    refs.trackList.appendChild(card);
  }
};

export const renderPlaylists = ({ onSharePlaylist, onRemoveFromPlaylist }) => {
  refs.playlistList.innerHTML = "";
  renderListsFocus();

  if (state.shareToken) {
    if (state.playlists.length === 0) {
      renderEmpty(refs.playlistList, "У shared view нет дополнительных плейлистов.");
    }
    return;
  }

  if (state.playlists.length === 0) {
    renderEmpty(refs.playlistList, "Плейлистов пока нет.");
    return;
  }

  for (const playlist of state.playlists) {
    const card = document.createElement("article");
    card.className = "playlist-card";

    const head = document.createElement("div");
    head.className = "playlist-head";
    head.innerHTML = `
      <div>
        <div class="track-title">${playlist.name}</div>
        <div class="playlist-subtitle">${playlist.tracks.length} tracks</div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "playlist-actions";

    const shareButton = document.createElement("button");
    shareButton.className = "secondary";
    shareButton.textContent = "Share";
    shareButton.addEventListener("click", async () => onSharePlaylist(playlist));
    actions.appendChild(shareButton);

    card.append(head, actions);

    const list = document.createElement("ul");
    list.className = "playlist-track-list";

    if (playlist.tracks.length === 0) {
      const empty = document.createElement("li");
      empty.className = "playlist-track-row";
      empty.innerHTML = "<span class='playlist-subtitle'>Пока пусто. Добавь треки из библиотеки.</span>";
      list.appendChild(empty);
    } else {
      for (const track of playlist.tracks) {
        const row = document.createElement("li");
        row.className = "playlist-track-row";

        const meta = document.createElement("div");
        meta.innerHTML = `<strong>${track.title}</strong><div class="playlist-subtitle">${track.artist}</div>`;

        const rowActions = document.createElement("div");
        rowActions.className = "playlist-actions";

        const playButton = document.createElement("button");
        playButton.className = "secondary";
        playButton.textContent = "Play";
        playButton.addEventListener("click", async () => {
          await playTrack(track);
          syncPlayerMeta();
        });
        rowActions.appendChild(playButton);

        const removeButton = document.createElement("button");
        removeButton.className = "ghost";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", async () => onRemoveFromPlaylist(playlist, track));
        rowActions.appendChild(removeButton);

        row.append(meta, rowActions);
        list.appendChild(row);
      }
    }

    card.appendChild(list);
    refs.playlistList.appendChild(card);
  }
};

export const renderShares = ({ onCopyShare, onRevokeShare }) => {
  refs.shareList.innerHTML = "";

  if (state.shareToken) {
    renderEmpty(refs.shareList, "В режиме shared view управление ссылками отключено.");
    return;
  }

  if (state.shares.length === 0) {
    renderEmpty(refs.shareList, "Активных публичных ссылок пока нет.");
    return;
  }

  for (const share of state.shares) {
    const card = document.createElement("article");
    card.className = "share-card";
    card.innerHTML = `
      <div class="share-head">
        <div>
          <div class="track-title">${share.type === "track" ? "Track link" : "Playlist link"}</div>
          <div class="share-meta">Target: ${share.targetId}</div>
        </div>
        <div class="share-meta">${share.expiresAt ? new Date(share.expiresAt).toLocaleString("ru-RU") : "Never expires"}</div>
      </div>
      <p><a class="share-url" href="${share.url}" target="_blank" rel="noreferrer">${share.url}</a></p>
    `;

    const actions = document.createElement("div");
    actions.className = "share-actions";

    const copyButton = document.createElement("button");
    copyButton.className = "secondary";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async () => onCopyShare(share));
    actions.appendChild(copyButton);

    const revokeButton = document.createElement("button");
    revokeButton.className = "danger";
    revokeButton.textContent = "Revoke";
    revokeButton.addEventListener("click", async () => onRevokeShare(share));
    actions.appendChild(revokeButton);

    card.appendChild(actions);
    refs.shareList.appendChild(card);
  }
};
