// lib/useDerivedIntakeAnswers.ts
// Keeps the intake answers' auto-computed fields in sync whenever their
// source field changes: monthly_rent_words from monthly_rent_amount (Form
// 400's written-out rent amount), and tenant1/tenant2 first/last name from
// each tenant's Full Name field (2229E's separate name boxes — hidden from
// the UI, see lib/formTypes.ts's `hidden` flag). Shared by app/intake/IntakeForm.tsx
// and app/review/ReviewForm.tsx's inline editor so both stay in sync the same way.

import { useEffect } from "react";
import { numberToWords } from "./numberToWords";
import { splitFullName } from "./splitFullName";

export function useDerivedIntakeAnswers(
  answers: Record<string, string>,
  setAnswers: (updater: (prev: Record<string, string>) => Record<string, string>) => void
) {
  useEffect(() => {
    const words = numberToWords(answers.monthly_rent_amount ?? "");
    setAnswers((prev) => (prev.monthly_rent_words === words ? prev : { ...prev, monthly_rent_words: words }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.monthly_rent_amount]);

  useEffect(() => {
    const { firstName, lastName } = splitFullName(answers.tenant1_full_name ?? "");
    setAnswers((prev) =>
      prev.tenant1_first_name === firstName && prev.tenant1_last_name === lastName
        ? prev
        : { ...prev, tenant1_first_name: firstName, tenant1_last_name: lastName }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.tenant1_full_name]);

  useEffect(() => {
    const { firstName, lastName } = splitFullName(answers.tenant2_full_name ?? "");
    setAnswers((prev) =>
      prev.tenant2_first_name === firstName && prev.tenant2_last_name === lastName
        ? prev
        : { ...prev, tenant2_first_name: firstName, tenant2_last_name: lastName }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.tenant2_full_name]);
}
