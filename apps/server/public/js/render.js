import { refs } from "./dom.js";
import { createPlaylistCard } from "./components/playlistCard.js";
import { createShareCard } from "./components/shareCard.js";
import { createTrackCard } from "./components/trackCard.js";
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
    const card = createTrackCard({
      track,
      isCurrentTrackPlaying: state.currentTrack?.id === track.id && !refs.player.paused,
      showPrivateActions: !state.shareToken,
      playlists: state.playlists,
      onPlayToggle: async () => {
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
      },
      onAddToPlaylist: async (playlistId) => onAddToPlaylist(track, playlistId),
      onShareTrack: async () => onShareTrack(track),
      onEditTrack: async () => onEditTrack(track),
      onDeleteTrack: async () => onDeleteTrack(track)
    });
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
    const card = createPlaylistCard({
      playlist,
      onSharePlaylist: async () => onSharePlaylist(playlist),
      onPlayTrack: async (track) => {
        await playTrack(track);
        syncPlayerMeta();
      },
      onRemoveTrack: async (track) => onRemoveFromPlaylist(playlist, track)
    });
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
    const card = createShareCard({
      share,
      onCopyShare: async () => onCopyShare(share),
      onRevokeShare: async () => onRevokeShare(share)
    });
    refs.shareList.appendChild(card);
  }
};
