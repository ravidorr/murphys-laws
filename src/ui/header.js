// Header component in plain JS
import { navigate as _navigate } from '../router.js';

export function Header({ currentPage }) {
  const el = document.createElement('header');
  el.className = 'sticky';

  el.innerHTML = `
    <div class="container">
      <div class="flex h-16 items-center justify-between">
        <a class="brand" href="#/home">
          <span class="brand-badge">M</span>
          <span class="font-semibold brand-name">Murphy's Law Archive</span>
        </a>

        <nav class="flex items-center gap-2">
          <a class="${currentPage === 'browse' ? '' : 'outline'} btn" href="#/browse">Browse All Laws</a>
          <a class="${currentPage === 'calculator' ? '' : 'outline'} btn" href="#/calculator">Sod's Law Calculator</a>
          <a class="${currentPage === 'submit' ? '' : 'outline'} btn" href="#/submit">Submit a Law</a>
        </nav>
      </div>
    </div>
  `;

  return el;
}
