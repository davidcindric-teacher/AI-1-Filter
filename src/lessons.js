import { validateCustomDataset } from './customData.js';

/** Lektionerna som eleven väljer mellan. 'all' visar hela appen (för lärare eller den som vill se allt). */
export const LESSONS = Object.freeze({
  1: { title: 'Grundmodell', goal: 'Träna en modell på dataset A och testa fyra egna påhittade meddelanden.' },
  2: { title: 'Träningsdata', goal: 'Jämför dataset A och B: samma inställningar men olika träningsdata.' },
  3: { title: 'Antal epoker', goal: 'Träna dataset B med 5, 30 och 100 epoker och undersök kurvorna.' },
  4: { title: 'Förbättring och sluttest', goal: 'Förbättra dataset B, jämför före och efter och kör sluttestet en gång.' },
  5: { title: 'Individuell analys', goal: 'Analysera dina resultat i ditt eget arbetsdokument. Appen ger tabeller och en analysmall.' },
});
export const LESSON_KEYS = Object.freeze([1, 2, 3, 4, 5]);

/** Laborationer (träningslägen) som hör till varje lektion. Den första är lektionens huvudlaboration. */
export const LESSON_MODES = Object.freeze({
  1: ['single'],
  2: ['compare-datasets', 'compare-abc'],
  3: ['compare-epochs', 'compare-lr', 'compare-hidden'],
  4: ['improve'],
});

/** Vilka dataset-kort som visas i respektive lektion. A och B alltid, eget mix bara i lektion 2, förbättrad B bara i lektion 4. */
export function allowedDatasets(lesson) {
  if (lesson === 'all') return ['a', 'b', 'custom', 'mix'];
  if (lesson === 4) return ['a', 'b', 'custom'];
  if (lesson === 2) return ['a', 'b', 'mix'];
  return ['a', 'b'];
}

export const isValidLesson = (v) => v === 'all' || LESSON_KEYS.includes(v);

/** Alla lektioner är öppna. Bara "Alla" låses upp med lärarkoden. */
export const isUnlocked = (state, lesson) => lesson !== 'all' || state.allUnlocked;

export function lessonOfMode(mode) {
  for (const [lesson, modes] of Object.entries(LESSON_MODES)) if (modes.includes(mode)) return Number(lesson);
  return 1;
}

/** Ger det läge som ska väljas när eleven byter lektion (behåller nuvarande läge om det redan hör till lektionen). */
export function modeForLesson(lesson, currentMode) {
  const modes = LESSON_MODES[lesson];
  if (!modes) return currentMode;
  return modes.includes(currentMode) ? currentMode : modes[0];
}

/** Vilka avsnitt (id) som visas i varje lektion. Elementen i sidan har data-lessons med samma siffror. */
export const isVisibleIn = (lessonsAttr, lesson) => lesson === 'all' || lessonsAttr.split(/\s+/).includes(String(lesson));

const uniqueTexts = (log) => new Set(log.map((t) => t.text.trim().toLowerCase())).size;

/**
 * Lektionsguidens steg. Automatiska steg bockas av utifrån vad eleven faktiskt gjort i appen.
 * Manuella steg (kind: 'manual') bockar eleven själv, eftersom appen inte kan veta om något skrivits i dokumentet.
 */
export function guideSteps(lesson, s) {
  if (!LESSON_KEYS.includes(lesson)) return [];
  const trained = (modes) => s.runs.length > 0 && modes.includes(s.runsMode);
  const tests = uniqueTexts(s.testLog);
  const copied = s.runs.length > 0 && s.copied.result && s.copied.recovery;
  const manual = (id, target, text) => ({ id, kind: 'manual', target, text, done: Boolean(s.manualDone[id]) });
  const auto = (id, target, text, done) => ({ id, kind: 'auto', target, text, done: Boolean(done) });
  const copyStep = auto(`l${lesson}-copy`, '#spara', 'Kopiera resultatblock och återställningstext till ditt arbetsdokument', copied);

  switch (lesson) {
    case 1:
      return [
        auto('l1-train', '#trana', 'Träna modellen från början', trained(['single'])),
        manual('l1-look', '#resultat', 'Titta på accuracy, förväxlingsmatrisen och de felklassificerade texterna. Vilka fel gjorde modellen?'),
        auto('l1-test', '#testa', `Testa fyra egna påhittade meddelanden (${Math.min(tests, 4)} av 4)`, tests >= 4),
        copyStep,
      ];
    case 2:
      return [
        auto('l2-train', '#trana', 'Träna dataset A och B med samma inställningar', trained(['compare-datasets', 'compare-abc'])),
        manual('l2-compare', '#resultat', 'Jämför A och B sida vid sida. Vad skiljer i träningsdata och i resultat?'),
        auto('l2-test', '#testa', `Testa samma texter på båda modellerna (${Math.min(tests, 2)} av minst 2 texter)`, tests >= 2),
        copyStep,
      ];
    case 3:
      return [
        auto('l3-train', '#trana', 'Träna dataset B med 5, 30 och 100 epoker', trained(['compare-epochs', 'compare-lr', 'compare-hidden'])),
        manual('l3-curves', '#resultat', 'Titta på kurvorna. Finns tecken på underanpassning eller överanpassning?'),
        manual('l3-write', '#resultat', 'Skriv i ditt dokument vad du ser och vad som gör slutsatsen osäker'),
        copyStep,
      ];
    case 4:
      return [
        auto('l4-data', '#byt-texter', 'Byt ut fem texter per klass så att datamängden är giltig', validateCustomDataset(s.edits).ok),
        auto('l4-train', '#fore-efter', 'Träna före och efter förbättringen', trained(['improve'])),
        auto('l4-final', '#sluttest', 'Kör sluttestet en gång', s.finalTestRuns >= 1),
        manual('l4-compare', '#sluttest', 'Jämför före och efter på både valideringsdata och sluttest i ditt dokument'),
        copyStep,
      ];
    default:
      return [
        auto('l5-template', '#extra', 'Kopiera analysmallen (steget Fördjupning)', s.copied.analysis),
        manual('l5-write', '#spara', 'Skriv din analys i ditt dokument. Varje påstående ska stödjas av dina egna siffror'),
        manual('l5-review', '#extra', 'Byt analys med en kamrat och granska med checklistan'),
        auto('l5-copy', '#spara', 'Kopiera resultatblock och återställningstext', copied),
      ];
  }
}

export function guideProgress(steps) {
  return { done: steps.filter((x) => x.done).length, total: steps.length };
}
