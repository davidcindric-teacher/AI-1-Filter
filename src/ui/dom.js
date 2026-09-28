// Små hjälpfunktioner för att bygga DOM utan ramverk.
// children.flat(Infinity) plattar ut godtyckligt djupt nästlade arrayer (t.ex. array.map(() => [nod, ' '])),
// vilket krävs eftersom flera anrop bygger listor av [element, avgränsare]-par.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') el.value = value;
    else if (key === 'checked' || key === 'disabled' || key === 'hidden' || key === 'open') el[key] = Boolean(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const $ = (selector, root = document) => root.querySelector(selector);

export function replace(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
}

let idCounter = 0;
export const uid = (prefix = 'id') => `${prefix}-${++idCounter}`;

/** Tabell med rubrikrad. rows = array av arrayer (strängar eller noder). */
export function table({ caption, headers, rows, className = '', rowHeaders = false }) {
  return h(
    'div',
    { class: 'table-scroll' },
    h(
      'table',
      { class: className },
      caption ? h('caption', { text: caption }) : null,
      h('thead', {}, h('tr', {}, headers.map((t) => h('th', { scope: 'col' }, t)))),
      h(
        'tbody',
        {},
        rows.map((r) =>
          h('tr', {}, r.map((cell, i) => (rowHeaders && i === 0 ? h('th', { scope: 'row' }, cell) : h('td', {}, cell)))),
        ),
      ),
    ),
  );
}

/** Etikett + "?"-knapp som öppnar en kort förklaringsruta (fungerar utan hover, med tangentbord och touch). */
export function explained(label, text) {
  const panelId = uid('explain');
  // Utropstecken: en <span> (inline), inte en <p> (block), eftersom hela explained() returneras som en
  // <span> tänkt att sitta inuti tabellceller, etiketter och listor. En <p> är inte giltigt innehåll i en
  // <span> enligt HTML:s innehållsmodell, även om webbläsare visar den rätt. CSS:ens .explain gör den ändå
  // blockvisad (display: block), så utseendet är oförändrat.
  const panel = h('span', { class: 'explain', id: panelId, hidden: true, text });
  const btn = h('button', {
    type: 'button',
    class: 'explain-btn',
    'aria-expanded': 'false',
    'aria-controls': panelId,
    'aria-label': `Förklara: ${label}`,
    text: '?',
    onclick: () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    },
  });
  return h('span', { class: 'explained' }, h('span', { text: label }), btn, panel);
}

/** Kopierar text till urklipp. Faller tillbaka på en tillfällig textruta om Clipboard API saknas. */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* faller igenom till reservlösningen */
  }
  const ta = h('textarea', { 'aria-hidden': 'true', tabindex: '-1', class: 'offscreen' });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export function downloadTextFile(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Skickar ett kort meddelande till skärmläsare via den dolda statusregionen. */
export function announce(message) {
  const region = document.getElementById('status-region');
  if (!region) return;
  region.textContent = '';
  setTimeout(() => (region.textContent = message), 30);
}
