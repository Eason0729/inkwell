export interface TemplateVars {
  [key: string]: string;
}

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/;

function parseCond(expr: string, vars: TemplateVars): boolean {
  const m = expr.match(/^\s*(\w+)\s*(==|!=)\s*(['"]?)(.*?)\3\s*$/);
  if (!m) return !!vars[expr.trim()];
  const actual = vars[m[1]!] ?? '';
  if (m[2] === '==') return actual === m[4];
  if (m[2] === '!=') return actual !== m[4];
  return false;
}

function findEndif(tmpl: string, start: number): number {
  let depth = 1;
  let pos = start;
  while (pos < tmpl.length && depth > 0) {
    const nif = tmpl.indexOf('{% if ', pos);
    const nend = tmpl.indexOf('{% endif %}', pos);
    if (nend === -1) return -1;
    if (nif !== -1 && nif < nend) {
      depth++;
      pos = nif + 6;
    } else {
      depth--;
      pos = nend + 11;
    }
  }
  return pos - 11;
}

function findTopElseOrEndif(tmpl: string, target: string): number {
  let depth = 0;
  let pos = 0;
  while (pos < tmpl.length) {
    const nif = tmpl.indexOf('{% if ', pos);
    const nt = tmpl.indexOf(target, pos);
    const nend = tmpl.indexOf('{% endif %}', pos);
    if (nt !== -1 && (nif === -1 || nt < nif) && (nend === -1 || nt < nend) && depth === 0) return nt;
    if (nif !== -1 && (nend === -1 || nif < nend)) {
      depth++;
      pos = nif + 6;
    } else if (nend !== -1) {
      depth--;
      pos = nend + 11;
    } else break;
  }
  return -1;
}

function splitBranches(block: string): Array<{ cond: string | null; body: string }> {
  const branches: Array<{ cond: string | null; body: string }> = [];
  let remaining = block;

  const firstEnd = remaining.indexOf('%}');
  if (firstEnd === -1) return [{ cond: null, body: remaining }];

  const firstCond = remaining.substring(0, firstEnd).trim();
  remaining = remaining.substring(firstEnd + 2);

  const elseIdx = findTopElseOrEndif(remaining, '{% else %}');
  const elifRe = /\{%\s*elif\s+/;
  const elifMatch = remaining.match(elifRe);
  const elifIdx = elifMatch ? findTopElseOrEndif(remaining, elifMatch[0]) : -1;
  const elifTagLen = elifMatch ? elifMatch[0].length : 0;

  if (elifIdx !== -1 && (elseIdx === -1 || elifIdx < elseIdx)) {
    branches.push({ cond: firstCond, body: remaining.substring(0, elifIdx).trim() });
    const after = remaining.substring(elifIdx);
    const ce = after.indexOf('%}');
    const cond = after.substring(elifTagLen, ce).trim();
    remaining = after.substring(ce + 2);
    branches.push(...splitBranches(cond + '%}' + remaining));
  } else if (elseIdx !== -1) {
    branches.push({ cond: firstCond, body: remaining.substring(0, elseIdx).trim() });
    branches.push({ cond: null, body: remaining.substring(elseIdx + 10).trim() });
  } else {
    branches.push({ cond: firstCond, body: remaining.trim() });
  }

  return branches;
}

export function renderTemplate(tmpl: string, vars: TemplateVars): string {
  let out = '';
  let i = 0;

  while (i < tmpl.length) {
    const ifStart = tmpl.indexOf('{% if ', i);
    const varMatch = tmpl.substring(i).match(VAR_RE);

    let nextSpecial: number | null = null;
    let isIf = false;

    if (ifStart !== -1 && (!varMatch || ifStart < i + varMatch.index!)) {
      nextSpecial = ifStart;
      isIf = true;
    } else if (varMatch) {
      nextSpecial = i + varMatch.index!;
      isIf = false;
    }

    if (nextSpecial === null) {
      out += tmpl.substring(i);
      break;
    }

    out += tmpl.substring(i, nextSpecial);
    i = nextSpecial;

    if (!isIf) {
      const m = tmpl.substring(i).match(VAR_RE)!;
      out += vars[m[1]!] ?? '';
      i += m[0].length;
      continue;
    }

    const endIdx = findEndif(tmpl, i + 6);
    if (endIdx === -1) {
      out += tmpl.substring(i);
      break;
    }

    const block = tmpl.substring(i + 6, endIdx);
    const branches = splitBranches(block);
    let matched = '';

    for (let b = 0; b < branches.length; b++) {
      const br = branches[b]!;
      if (b === branches.length - 1 && br.cond === null) {
        if (!matched) matched = br.body;
        break;
      }
      if (!matched && parseCond(br.cond!, vars)) {
        matched = br.body;
        break;
      }
    }

    out += renderTemplate(matched, vars);
    i = endIdx + 11;
  }

  return out.trim();
}
