//  remove backslash \
//  remove tabs \t
//  removes whitespace from both the beginning and end of the string.
export function sanitize(input: string) {
  return input.trim().replace(/\\/g, "").replace(/\t/g, "");
}
