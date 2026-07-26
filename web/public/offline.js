const reload = () => window.location.reload();

document.querySelector('[data-retry]')?.addEventListener('click', reload);
window.addEventListener('online', reload);
