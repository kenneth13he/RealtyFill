// lib/numberToWords.ts
// Converts a plain numeric string (e.g. "3900.00") into the Title Case words
// a legal document expects (e.g. "Three Thousand Nine Hundred"), matching
// the real Form 400 convention seen on the ground-truth filled forms this
// project was built against ($3,900.00 → "Three Thousand Nine Hundred",
// $7,800.00 → "Seven Thousand Eight Hundred" — whole-dollar amounts, no
// "Dollars" suffix, no cents when the cents are zero).

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion"];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)], "Hundred");
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]);
    n %= 10;
    if (n > 0) parts.push(ONES[n]);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

export function numberToWords(amount: string): string {
  const cleaned = amount.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";

  const [wholeStr, centsStr = ""] = cleaned.split(".");
  const whole = parseInt(wholeStr || "0", 10);
  if (Number.isNaN(whole)) return "";

  if (whole === 0) return "Zero";

  const groups: string[] = [];
  let remaining = whole;
  let scaleIndex = 0;
  while (remaining > 0) {
    const group = remaining % 1000;
    if (group > 0) {
      const groupWords = threeDigitsToWords(group);
      groups.unshift(SCALES[scaleIndex] ? `${groupWords} ${SCALES[scaleIndex]}` : groupWords);
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }

  const words = groups.join(" ");
  const cents = parseInt((centsStr + "00").slice(0, 2), 10);
  return cents > 0 ? `${words} and ${cents}/100` : words;
}
