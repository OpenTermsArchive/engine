const CONTROL_CHARACTERS_REGEXP = /\p{Cc}/u; // Matches any Unicode "control" character: the C0 range (U+0000 to U+001F), DEL (U+007F) and the C1 range (U+0080 to U+009F), i.e. 65 non-printable characters including NUL. The `u` flag is required for the `\p{...}` property escape to be recognised, otherwise the pattern would match the literal text `p{Cc}`. Legitimate service IDs, terms types and document IDs never contain these, and NUL in particular can truncate a value once it reaches git or the filesystem, so any segment holding one is rejected.

// Keeps hostile values from reaching git, where a pathspec that resolves outside the repository (such as `../foo/*`) aborts with an error that exposes the repository location.
export function isPlainPathSegment(segment) {
  return segment.length > 0
    && segment !== '.'
    && segment !== '..'
    && !segment.includes('/')
    && !segment.includes('\\')
    && !CONTROL_CHARACTERS_REGEXP.test(segment);
}
