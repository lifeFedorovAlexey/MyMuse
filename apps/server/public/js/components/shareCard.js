import { createActionButton } from "./actionButton.js";

export const createShareCard = ({ share, onCopyShare, onRevokeShare }) => {
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
  actions.append(
    createActionButton({
      label: "Copy",
      className: "secondary",
      onClick: onCopyShare
    }),
    createActionButton({
      label: "Revoke",
      className: "danger",
      onClick: onRevokeShare
    })
  );

  card.appendChild(actions);
  return card;
};
