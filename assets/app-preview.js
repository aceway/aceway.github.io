// Keep the home and detail preview fallbacks aligned without inventing screenshots.
window.H53D_PREVIEW = {
  renderIcon(container, app) {
    const children = [];
    if (app.icon) {
      const icon = document.createElement('img');
      icon.src = `/assets/${encodeURIComponent(app.name)}/${app.icon}`;
      icon.alt = '';
      icon.width = 112;
      icon.height = 112;
      icon.className = 'preview-app-icon';
      children.push(icon);
    }
    const name = document.createElement('strong');
    name.className = 'preview-app-name';
    name.textContent = app.name;
    children.push(name);
    if (app.promotional) {
      const promo = document.createElement('span');
      promo.className = 'preview-app-promo';
      promo.textContent = app.promotional;
      children.push(promo);
    }
    container.replaceChildren(...children);
  }
};
