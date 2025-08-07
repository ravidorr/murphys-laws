export function Auth({ type, onNavigate, onAuth }) {
  const el = document.createElement('div');
  el.className = 'container';
  el.style.padding = '2rem 1rem';
  const title = type === 'signup' ? 'Sign Up' : 'Log In';
  el.innerHTML = `
    <h2 style="font-size:1.5rem; margin-bottom:1rem;">${title}</h2>
    <form class="card"><div class="card-content">
      <div style="margin-bottom:.75rem;">
        <label class="small" for="username">Username</label><br/>
        <input id="username" type="text" placeholder="yourname" />
      </div>
      <div style="margin-bottom:.75rem;">
        <label class="small" for="password">Password</label><br/>
        <input id="password" type="password" placeholder="••••••••" />
      </div>
      <button type="submit">${title}</button>
      <button type="button" class="outline" data-nav="home" style="margin-left:.5rem;">Cancel</button>
    </div></form>
  `;
  el.addEventListener('click', (e) => {
    const t = e.target; if (t instanceof HTMLElement && t.dataset.nav) onNavigate(t.dataset.nav);
  });
  el.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = /** @type {HTMLInputElement} */(el.querySelector('#username'))?.value?.trim() || 'user';
    onAuth(username);
  });
  return el;
}

