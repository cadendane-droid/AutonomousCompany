// TIER A: fully working. Minimal glob matcher for protected-path patterns:
// `**` crosses directory separators, `*` stays within one segment.
export function globToRegExp(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i++;
        // swallow a following slash so "brand/**" matches "brand/x" and "brand"
        if (glob[i + 1] === '/') i++;
      } else {
        out += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchesAny(path: string, globs: string[]): string | null {
  for (const glob of globs) {
    if (globToRegExp(glob).test(path)) return glob;
  }
  return null;
}
