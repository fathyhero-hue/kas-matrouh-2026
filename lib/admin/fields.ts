export function pickAllowedFields<T extends Record<string, unknown>>(input: Record<string, unknown>, allowed: readonly string[]): Partial<T> {
  const output: Record<string, unknown> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, key)) output[key] = input[key];
  }
  return output as Partial<T>;
}