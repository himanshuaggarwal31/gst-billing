/** Shared utilities used across PDF components (InvoicePDF, EWayBillPDF, etc.) */

/**
 * Convert an amount (rupees) to Indian words.
 * e.g. 123456.78 → "One Lakh Twenty-Three Thousand Four Hundred Fifty-Six Rupees and Seventy-Eight Paise Only"
 */
export function amountInWords(amount: number): string {
  const rounded = Math.round(amount * 100);
  const rupees = Math.floor(rounded / 100);
  const paise = rounded % 100;

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function toWords(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + toWords(n % 100) : "");
    if (n < 100000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + toWords(n % 1000) : "");
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + toWords(n % 100000) : "");
    return toWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + toWords(n % 10000000) : "");
  }

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";
  let result = rupees > 0 ? toWords(rupees) + " Rupees" : "";
  if (paise > 0) result += (result ? " and " : "") + toWords(paise) + " Paise";
  return result + " Only";
}

/** Validate and resolve a brand accent colour hex string, falling back to the provided default. */
export function resolveAccentColor(accentColor: string | null | undefined, defaultColor: string): string {
  return accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : defaultColor;
}
