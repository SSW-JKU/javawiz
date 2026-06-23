/**
 * Manages the width limit of AstElements
 */
export class FullWidthManager {
  #fullWidthSet = new Set<string>()

  /**
     * @constructor
     * @param changeCallback called when the state of an element changes
     */
  constructor (private readonly changeCallback: () => void) {}

  /**
     * Check the full width of the element
     * @param uuid UUID to check
     * @returns true if the element is currently in full width, false otherwise
     */
  public hasFullWidth (uuid: string): boolean {
    return this.#fullWidthSet.has(uuid)
  }

  /**
     * Toggle the full width of an element
     * @param uuid UUID of the element to toggle
     */
  public toggle (uuid: string): void {
    if (this.#fullWidthSet.has(uuid)) {
      this.#fullWidthSet.delete(uuid)
    } else {
      this.#fullWidthSet.add(uuid)
    }
    this.changeCallback()
  }
}
