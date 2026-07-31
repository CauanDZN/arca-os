"use server";

import { prisma } from "@/lib/prisma";
import { generateMeetingMinutes } from "@/lib/ai";
import { meetingNotesSchema } from "@/lib/validation";
import { getSession } from "@/lib/auth";
import { assertCompanyAccess } from "@/lib/access";
import { redirect } from "next/navigation";

export async function createMeetingNote(companyId: string, formData: FormData) {
  assertCompanyAccess(await getSession(), companyId);

  const { rawNotes } = meetingNotesSchema.parse({
    rawNotes: String(formData.get("rawNotes") ?? ""),
  });

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const minutes = await generateMeetingMinutes(company.name, rawNotes);

  await prisma.meetingNote.create({
    data: {
      companyId,
      rawNotes,
      summary: minutes ? JSON.stringify(minutes) : null,
    },
  });

  redirect(`/empresas/${companyId}/reunioes`);
}

export async function deleteMeetingNote(companyId: string, noteId: string) {
  assertCompanyAccess(await getSession(), companyId);

  const note = await prisma.meetingNote.findUnique({ where: { id: noteId } });
  if (note && note.companyId === companyId) {
    await prisma.meetingNote.delete({ where: { id: noteId } });
  }
  redirect(`/empresas/${companyId}/reunioes`);
}
