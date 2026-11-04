/**
 * Returns the port given in a URL query parameter, or undefined if the parameter
 * is missing or is not a single whole number from 1 to 65535.
 * The value comes from vue-router's route.query, which can also be null (parameter
 * without a value) or an array (parameter given more than once).
 *
 * Example: parsePortParameter('51235') === 51235, parsePortParameter('0') === undefined
 */
export function parsePortParameter (value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return undefined
  }
  const port = Number(value)
  return port >= 1 && port <= 65535 ? port : undefined
}
