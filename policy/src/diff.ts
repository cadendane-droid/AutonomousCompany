// TIER A: fully working. Parses git unified diff output (git diff / PR diff).
import type { DiffFile, ParsedDiff } from './types.js';

export function parseDiff(diffText: string): ParsedDiff {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;

  for (const line of diffText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (current) files.push(current);
      // "diff --git a/<old> b/<new>" — paths may contain spaces but not quotes
      // in the common case; git quotes exotic paths, which we treat as-is.
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      const oldPath = match?.[1] ?? '';
      const newPath = match?.[2] ?? '';
      current = {
        path: newPath,
        oldPath: oldPath === newPath ? null : oldPath,
        status: oldPath === newPath ? 'modified' : 'renamed',
        additions: 0,
        deletions: 0,
        addedLines: [],
      };
      continue;
    }
    if (!current) continue;

    if (line.startsWith('new file mode')) current.status = 'added';
    else if (line.startsWith('deleted file mode')) current.status = 'deleted';
    else if (line.startsWith('+++') || line.startsWith('---')) continue;
    else if (line.startsWith('+')) {
      current.additions++;
      current.addedLines.push(line.slice(1));
    } else if (line.startsWith('-')) current.deletions++;
  }
  if (current) files.push(current);

  return {
    files,
    totalAdditions: files.reduce((sum, f) => sum + f.additions, 0),
    totalDeletions: files.reduce((sum, f) => sum + f.deletions, 0),
  };
}
