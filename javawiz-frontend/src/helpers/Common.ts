export function shortTypeName (className: string): string {
  return className.split('.').pop() || 'error: could not shorten type name'
}
