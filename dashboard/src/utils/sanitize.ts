export function sanitize(input: string) {
  // replce \/ with /
  // replace \t with nothing
  // trim
  return input.trim().replace(/\//g, "").replace(/\t/g, "");
}
