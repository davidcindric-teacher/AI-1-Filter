import { describe, expect, it } from 'vitest';
import { normalizeText, tokenize } from '../src/ml/tokenizer.js';
import { buildVocabulary, toActiveIndices, toVector } from '../src/ml/vectorizer.js';

describe('1. Tokenisering', () => {
  it('gör gemener och delar på mellanslag och skiljetecken', () => {
    expect(tokenize('Vinn 5000 kr NU! Klicka här.')).toEqual(['vinn', '5000', 'kr', 'nu', 'klicka', 'här']);
  });
  it('behåller å, ä och ö och gemener för versaler som Å', () => {
    expect(tokenize('ÅSA äter Öl')).toEqual(['åsa', 'äter', 'öl']);
  });
  it('ger tom lista för tom text och bara skiljetecken', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('  !!! ?? ')).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
  });
  it('normalizeText ignorerar versaler och skiljetecken', () => {
    expect(normalizeText('Hej, du!')).toBe(normalizeText('hej du'));
  });
});

describe('2. Text till numerisk vektor', () => {
  const vocab = buildVocabulary(['Hej du', 'du vinner gratis']);
  it('vokabulären är sorterad och unik', () => {
    expect(vocab.words).toEqual(['du', 'gratis', 'hej', 'vinner']);
  });
  it('ger 1 för ord som finns och 0 för övriga', () => {
    expect(toVector('Hej hej!', vocab)).toEqual([0, 0, 1, 0]);
    expect(toVector('gratis du', vocab)).toEqual([1, 1, 0, 0]);
  });
  it('ignorerar okända ord och ger nollvektor', () => {
    expect(toVector('helt okänt', vocab)).toEqual([0, 0, 0, 0]);
  });
  it('vektorn har lika många positioner som vokabulären, och aktiva index stämmer', () => {
    expect(toVector('x', vocab)).toHaveLength(vocab.words.length);
    expect(toActiveIndices('vinner du', vocab)).toEqual([0, 3]);
  });
  it('vokabulären beror inte på texternas ordning', () => {
    expect(buildVocabulary(['b a', 'c']).words).toEqual(buildVocabulary(['c', 'a b']).words);
  });
});
