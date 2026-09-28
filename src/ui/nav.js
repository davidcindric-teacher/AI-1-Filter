let revealer = null;

/** Steg-för-steg-visningen registrerar här hur ett dolt steg visas innan sidan rullar dit. */
export function setRevealer(fn) {
  revealer = fn;
}

/** Går till ett avsnitt: rullar dit och flyttar tangentbordsfokus till avsnittets rubrik (bra för skärmläsare). */
export function goToSection(hash) {
  const target = document.querySelector(hash);
  if (!target || target.hidden) return false;
  revealer?.(target);
  target.scrollIntoView();
  const heading = target.matches('h2, h3') ? target : target.querySelector('h2, h3');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
  history.replaceState(null, '', hash);
  return true;
}
