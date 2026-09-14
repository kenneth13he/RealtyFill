// lib/splitFullName.ts
// Splits a full name into first/last name — last whitespace-separated token
// is the last name, everything before it is the first name. Used wherever a
// single "Full Name" field must also feed a form's separate first/last name
// boxes (e.g. 2229E's txtbuyer1FName/txtbuyer1LName) without asking the
// realtor to type the same name three times.

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const lastName = parts.pop()!;
  return { firstName: parts.join(" "), lastName };
}
