// app/api/account/route.ts
// Permanent account + data deletion (REMAINING_WORK item 7, and the
// retention/deletion capability the Privacy Policy promises).
//
// Order matters. Deleting the auth user cascades the database rows
// (deals -> deal_intake/generated_forms, plus profiles) via the ON DELETE
// CASCADE foreign keys in supabase/migrations/0001_init.sql — but Storage
// objects are NOT cascaded by that, so the PDFs must be removed first.
// Doing it in the other order would delete the account and orphan the
// user's generated PDFs in the bucket forever, with no session left to
// clean them up.

import { NextResponse } from "next/server";
import { isSameOrigin, crossOriginRefusal } from "@/lib/sameOrigin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError, userFacingError } from "@/lib/logger";

export async function DELETE(request: Request) {
  // Defence in depth behind the SameSite=Lax session cookie — see
  // lib/sameOrigin.ts for why a missing Origin is refused too.
  if (!isSameOrigin(request)) return crossOriginRefusal();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    // Storage first — objects live at {user_id}/{dealId}/{form}.pdf, so list
    // each deal folder under this user's prefix and remove its contents.
    const { data: dealFolders } = await admin.storage.from("generated-forms").list(user.id);
    for (const folder of dealFolders ?? []) {
      const { data: files } = await admin.storage.from("generated-forms").list(`${user.id}/${folder.name}`);
      if (files && files.length > 0) {
        await admin.storage.from("generated-forms").remove(files.map((f) => `${user.id}/${folder.name}/${f.name}`));
      }
    }

    const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      throw new Error(deleteErr.message);
    }
  } catch (err) {
    const ref = logError({ route: "account-delete", userId: user.id }, err);
    return NextResponse.json({ error: userFacingError(ref, "Couldn't delete your account."), ref }, { status: 500 });
  }

  // Clear the now-orphaned session cookie so the browser isn't left holding
  // a token for a user that no longer exists.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
