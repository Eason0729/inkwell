import { fixStructure } from './structure';

export function stripMarkers(text: string): string {
  return text
    .replace(/ <!-- [Vv][Ii][Oo][Ll][Aa][Tt][Ii][Oo][Nn]:[^>]+-->/g, '')
    .replace(/^<!-- [Vv][Ii][Oo][Ll][Aa][Tt][Ii][Oo][Nn]:[^>]+-->\n?/gm, '');
}

export function normalizeWhitespace(text: string): string {
  const lines = text.split('\n').map((l) => (l.trim() === '' ? '' : l));
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

export function postProcessResponse(response: string, source: string): string {
  response = stripMarkers(response);
  response = normalizeWhitespace(response);
  return fixStructure(source, response);
}
