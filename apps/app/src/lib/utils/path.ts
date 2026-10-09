// URL segments keep their encoding, and a hand-typed URL can hold a stray "%" that decodeURIComponent throws on
export const decodePathSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
