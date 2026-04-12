/**
 * String utility functions for consistent text processing across the app.
 */

/**
 * Normalizes a string for comparison and search operations.
 * Converts to lowercase, trims whitespace, and collapses multiple spaces.
 *
 * @param input - The string to normalize
 * @returns Normalized string
 *
 * @example
 * normalizeString("  Hello   World  ") // "hello world"
 */
export function normalizeString(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, " ");
}
