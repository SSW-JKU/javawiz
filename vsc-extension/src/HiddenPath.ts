/**
 * Returns whether a path contains a dot-prefixed file or directory name.
 * Both slash styles are supported because the input is a URI path rather than
 * a path resolved by the host operating system.
 */
export function hasHiddenPathSegment(filePath: string): boolean {
  return filePath.split(/[\\/]/).some(segment => segment.startsWith('.'))
}
