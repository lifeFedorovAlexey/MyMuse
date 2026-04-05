const renderItem = ({ label, active, placeholder, view }) => `
  <li class="left-menu__item${active ? " is-active" : ""}${placeholder ? " is-placeholder" : ""}">
    <button class="left-menu__button" type="button" data-view="${view || ""}"${active ? ' aria-current="page"' : ""}${placeholder ? " disabled" : ""}>
      ${label}
    </button>
  </li>
`;

export const renderLeftMenu = (container, { title, items = [] }) => {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <section class="left-menu" aria-label="${title}">
      <ul class="left-menu__list" role="list">
        ${items.map(renderItem).join("")}
      </ul>
    </section>
  `;
};
