import { createActionButton } from "./actionButton.js";

const makePlaylistSelector = (playlists) => {
  const select = document.createElement("select");
  select.className = "track-inline-select";
  for (const playlist of playlists) {
    const option = document.createElement("option");
    option.value = playlist.id;
    option.textContent = playlist.name;
    select.appendChild(option);
  }
  return select;
};

export const createTrackCard = ({
  track,
  isCurrentTrackPlaying,
  showPrivateActions,
  playlists,
  onPlayToggle,
  onAddToPlaylist,
  onShareTrack,
  onEditTrack,
  onDeleteTrack
}) => {
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
  actions.appendChild(
    createActionButton({
      label: isCurrentTrackPlaying ? "Пауза" : "Play",
      onClick: onPlayToggle
    })
  );

  if (showPrivateActions) {
    const moreButton = createActionButton({
      label: "More",
      className: "ghost",
      onClick: () => {
        morePanel.classList.toggle("hidden");
      }
    });

    const morePanel = document.createElement("div");
    morePanel.className = "track-more-actions hidden";

    if (playlists.length > 0) {
      const select = makePlaylistSelector(playlists);
      const addButton = createActionButton({
        label: "Add to list",
        className: "secondary",
        onClick: async () => onAddToPlaylist(select.value)
      });
      morePanel.append(select, addButton);
    }

    morePanel.append(
      createActionButton({
        label: "Share",
        className: "secondary",
        onClick: onShareTrack
      }),
      createActionButton({
        label: "Edit",
        className: "ghost",
        onClick: onEditTrack
      }),
      createActionButton({
        label: "Drop",
        className: "danger",
        onClick: onDeleteTrack
      })
    );

    actions.append(moreButton, morePanel);
  }

  main.append(head, actions);
  card.append(main);
  return card;
};
