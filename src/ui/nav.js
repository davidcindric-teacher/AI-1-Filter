/** Går till ett avsnitt: rullar dit och flyttar tangentbordsfokus till avsnittets rubrik (bra för skärmläsare). */
export function goToSection(hash) {
  const target = document.querySelector(hash);
  if (!target || target.hidden) return false;
  target.scrollIntoView();
  const heading = target.matches('h2, h3') ? target : target.querySelector('h2, h3');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
  history.replaceState(null, '', hash);
  return true;
}
