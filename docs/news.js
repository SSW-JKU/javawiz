/** Show the full article or its preview, keeping the button's accessible state in sync. */
function setExpanded(article, expanded) {
  article.querySelector('[data-preview]').hidden = expanded;
  article.querySelector('[data-content]').hidden = !expanded;
  const button = article.querySelector('[data-toggle]');
  const label = expanded ? 'Read less' : 'Read more';
  button.textContent = label;
  button.setAttribute('aria-expanded', String(expanded));
  button.setAttribute('aria-label', `${label}: ${article.querySelector('h2').textContent}`);
}

/** Apply homepage deep links; an archive URL without a fragment always starts collapsed. */
function applyNewsLocation() {
  const articles = document.querySelectorAll('[data-news]');
  articles.forEach(article => setExpanded(article, false));
  const target = Array.from(articles).find(article => `#${article.id}` === location.hash);
  if (target) {
    setExpanded(target, true);
    target.scrollIntoView();
  } else {
    window.scrollTo(0, 0);
  }
}

document.querySelectorAll('[data-toggle]').forEach(button => {
  button.addEventListener('click', () => {
    const article = button.closest('[data-news]');
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    setExpanded(article, expanded);
    // Collapsing a long article must not leave the reader below its new position.
    if (!expanded) article.scrollIntoView({ block: 'nearest' });
  });
});
window.addEventListener('hashchange', applyNewsLocation);
// pageshow also resets restored browser-history pages to the state requested by the URL.
window.addEventListener('pageshow', applyNewsLocation);
