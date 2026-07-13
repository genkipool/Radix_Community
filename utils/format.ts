/** Generic presentation helpers shared across features. */

export function shortAddress(address: string): string {
  return address.length > 20
    ? `${address.slice(0, 12)}…${address.slice(-6)}`
    : address;
}

/** Replace {placeholders} in an i18n template. */
export function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}
