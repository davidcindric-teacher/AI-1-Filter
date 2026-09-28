import { TEACHER_CODE } from '../config.js';
import { h } from './dom.js';

export const isTeacherCode = (value) => value.trim().toLowerCase() === TEACHER_CODE.toLowerCase();

/** Ruta där läraren skriver in lärarkoden. onUnlock anropas när koden är rätt. */
export function codeGate({ id, title, hint, onUnlock }) {
  const input = h('input', { type: 'text', id, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', class: 'code-input' });
  const msg = h('p', { class: 'code-error', role: 'alert' });
  const el = h(
    'form',
    {
      class: 'code-gate',
      onsubmit: (e) => {
        e.preventDefault();
        if (isTeacherCode(input.value)) {
          msg.textContent = '';
          onUnlock();
        } else {
          msg.textContent = 'Fel kod. Försök igen.';
          input.select();
        }
      },
    },
    h('p', { class: 'code-gate-title' }, h('span', { 'aria-hidden': 'true', text: '🔒 ' }), title),
    hint ? h('p', { class: 'muted small', text: hint }) : null,
    h('div', { class: 'code-row' }, h('label', { for: id, text: 'Lärarkod' }), input, h('button', { type: 'submit', class: 'btn btn-small', text: 'Lås upp' })),
    msg,
  );
  return { el, focus: () => input.focus() };
}
