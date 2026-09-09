/**
 * Starting values for builder fields, shared by the template and block
 * builders so a field of the same kind behaves the same in both.
 */

/** The shape both TemplateField and BlockField satisfy. */
export interface DefaultableField {
  key: string;
  kind: string;
  options?: string[];
}

/**
 * Only 'choice' needs a default. Its manifest output commits to one branch
 * whether or not the operator touched the control, so leaving the value empty
 * would show an unselected toggle over a manifest that already says `true`.
 */
export const defaultFieldValues = (
  fields: readonly DefaultableField[],
): Record<string, string> =>
  Object.fromEntries(
    fields
      .filter((field) => field.kind === 'choice' && field.options?.length)
      .map((field) => [field.key, field.options![0]]),
  );
