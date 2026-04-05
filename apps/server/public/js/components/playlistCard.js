import { createActionButton } from "./actionButton.js";

export const createPlaylistCard = ({ playlist, onSharePlaylist, onPlayTrack, onRemoveTrack }) => {
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
  actions.appendChild(
    createActionButton({
      label: "Share",
      className: "secondary",
      onClick: onSharePlaylist
    })
  );

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
      rowActions.append(
        createActionButton({
          label: "Play",
          className: "secondary",
          onClick: async () => onPlayTrack(track)
        }),
        createActionButton({
          label: "Remove",
          className: "ghost",
          onClick: async () => onRemoveTrack(track)
        })
      );

      row.append(meta, rowActions);
      list.appendChild(row);
    }
  }

  card.appendChild(list);
  return card;
};
