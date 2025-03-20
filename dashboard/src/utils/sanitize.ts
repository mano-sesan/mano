//  replace anormal spaces (tabs or whatever) with a normal space
//  then removes whitespace from both the beginning and end of the string.
//  then replace "\/" with "/"
export function sanitize(input: string) {
  return input.replace(/\s+/g, " ").trim().replace(/\\\//g, "/");
}
