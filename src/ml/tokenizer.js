/**
 * Enkel tokenisering som eleverna kan följa steg för steg:
 * 1. Gör om till gemener.
 * 2. Allt som inte är bokstäver eller siffror (mellanslag, punkt, !, ?) blir en avgränsare.
 * 3. Dela upp i ord ("tokens").
 * Svenska tecken (å, ä, ö) behålls. Ingen stamning eller ordlista används.
 */
export function tokenize(text) {
  return String(text ?? '')
    .toLocaleLowerCase('sv')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Normaliserad form för att jämföra om två texter är "samma text" (ignorerar versaler och skiljetecken). */
export function normalizeText(text) {
  return tokenize(text).join(' ');
}
