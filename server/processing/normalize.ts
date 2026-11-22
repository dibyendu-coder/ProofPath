import { validateText } from '../intake-validation.js';

export function normalizeSubmittedText(input: string): {
  text: string;
  changed: boolean;
} {
  validateText(input);
  const text = input
    .replace(/\r\n?/g, '\n')
    .split('')
    .filter((character) => {
      const point = character.charCodeAt(0);
      return (
        point === 9 ||
        point === 10 ||
        (point >= 32 && point !== 127 && (point < 128 || point > 159))
      );
    })
    .join('')
    .replace(/\t/g, ' ')
    .replace(/ {3,}/g, '  ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  validateText(text);
  return { text, changed: text !== input };
}
