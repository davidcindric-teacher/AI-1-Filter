// localStorage används ENDAST som extra bekvämlighet för inställningar och egna ändringar.
// Webbläsaren kan rensa den, den kan vara blockerad (t.ex. privat surfning) och den finns bara på den här enheten.
// Appen lovar därför aldrig att något finns kvar. Arbetsdokumentet är den riktiga sparplatsen.
const KEY = 'spamfilter-lab.bekvamlighet.v1';

export function saveConvenience(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadConvenience() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearConvenience() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignoreras: bekvämlighetsfunktion */
  }
}
