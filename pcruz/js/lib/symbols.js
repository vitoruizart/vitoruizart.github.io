// Chart symbols, most distinctive first (palette entry i gets SYMBOLS[i]).
// ASCII + one Latin-1 sign (÷) only, so every system font renders them.
// Excludes look-alikes: 0/O/o, 1/I/l/|, ×/X, and lowercase letters that read
// as their capital at small sizes (c, k, o, p, s, u, v, w, x, z).
export const SYMBOLS = [
  '2', '3', '4', '5', '6', '7', '8', '9',
  '+', '=', '#', '%', '&', '@', '*', '?', '!', '/', '<', '>', '^', '~', '$', '÷',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R',
  'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'a', 'b', 'd', 'e', 'f', 'g', 'h', 'm', 'n', 'q', 'r', 't', 'y'
];
