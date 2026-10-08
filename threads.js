const MAX_THREAD_AVATARS = 3;

function renderThreadsBadge({ count, authors }) {
  const badge = document.createElement('span');
  badge.className = 'fgu-threads';
  const who = authors.map(({ login, count: n }) => `${login} (${n})`).join(', ');
  badge.title = `${count} open review ${count === 1 ? 'comment' : 'comments'}${who ? `: ${who}` : ''}`;
  badge.setAttribute('aria-label', badge.title);

  const avatars = document.createElement('span');
  avatars.className = 'fgu-threads-avatars';
  for (const { login, name, avatarUrl } of authors.slice(0, MAX_THREAD_AVATARS)) {
    const img = document.createElement('img');
    img.className = 'fgu-threads-avatar';
    img.src = avatarUrl;
    img.alt = '';
    img.title = name || login;
    img.dataset.login = login;
    avatars.append(img);
  }

  const number = document.createElement('span');
  number.className = 'fgu-threads-count';
  number.textContent = String(count);
  badge.append(avatars, number);
  return badge;
}
