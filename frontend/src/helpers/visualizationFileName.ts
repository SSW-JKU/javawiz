/**
 * Pads a month, day, hour, or minute for the fixed-width export timestamp.
 */
function padDatePart (value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Creates the filename stem used for a visualization export.
 *
 * The timestamp uses the user's local time because it describes when the
 * export was created from their point of view. A date can be supplied by
 * callers and tests to keep the formatting deterministic.
 */
export function createVisualizationExportFileName (visualizationName: string, date = new Date()): string {
  const slug = visualizationName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const timestamp = [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
    padDatePart(date.getHours()),
    padDatePart(date.getMinutes())
  ].join('-')

  return `${timestamp}-javawiz-${slug}`
}
