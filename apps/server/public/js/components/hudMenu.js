const renderStat = ({ label, value }) => `
  <li class="hud-menu__stat">
    <span class="hud-menu__label">${label}</span>
    <span class="hud-menu__value">${value}</span>
  </li>
`;

export const renderHudMenu = (container, { title, stats = [] }) => {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <section class="hud-menu" aria-label="System HUD">
      <div class="hud-menu__title">${title}</div>
      <ul class="hud-menu__stats" role="list">
        ${stats.map(renderStat).join("")}
      </ul>
    </section>
  `;
};
