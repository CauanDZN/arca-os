import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { MeetingMinutes } from "@/lib/ai";
import { createMeetingNote, deleteMeetingNote } from "@/app/actions-meetings";
import { Card } from "@/app/components/Card";
import { SubmitButton } from "@/app/components/SubmitButton";
import { EmptyBoxIcon, ListChecksIcon, SparklesIcon } from "@/app/components/icons";

export default async function ReunioesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: { meetingNotes: { orderBy: { createdAt: "desc" } } },
  });
  if (!company) notFound();

  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const createAction = createMeetingNote.bind(null, id);

  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href={`/empresas/${id}`} className="text-sm text-slate-500 hover:text-slate-800">
          ← Voltar para {company.name}
        </Link>

        <Card>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 uppercase tracking-wide mb-1">
            <ListChecksIcon className="w-4 h-4" />
            Atas de Reunião
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{company.name}</h1>
          <p className="text-slate-600 mb-6">
            Cole ou digite as anotações brutas de uma reunião — o Agente Gerador de Ata organiza em
            resumo, decisões e pendências. Não há integração com calendário ou transcrição de áudio:
            a entrada é sempre manual.
          </p>

          <form action={createAction} className="space-y-3">
            <textarea
              name="rawNotes"
              required
              rows={6}
              placeholder="Ex.: Reunião com a diretoria em 30/07. Discutimos o atraso na contratação do gerente comercial. Ana ficou de fechar a vaga até sexta. Decidido adiar o lançamento da nova linha para setembro..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-shadow"
            />
            <SubmitButton
              pendingText="Gerando ata..."
              className="rounded-lg bg-blue-700 text-white font-semibold px-5 py-2 text-sm hover:bg-blue-800 transition-colors"
            >
              Gerar ata
            </SubmitButton>
            {!hasGeminiKey && (
              <p className="text-xs text-slate-400">
                Sem chave de IA configurada — as anotações serão salvas, mas sem estruturação automática.
              </p>
            )}
          </form>
        </Card>

        <div className="space-y-4">
          {company.meetingNotes.map((note) => {
            const minutes: MeetingMinutes | null = note.summary ? JSON.parse(note.summary) : null;
            return (
              <Card key={note.id} className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400">
                    {new Date(note.createdAt).toLocaleDateString("pt-BR")} às{" "}
                    {new Date(note.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <form action={deleteMeetingNote.bind(null, id, note.id)}>
                    <SubmitButton pendingText="Removendo..." className="text-xs text-red-600 hover:underline disabled:no-underline">
                      Remover
                    </SubmitButton>
                  </form>
                </div>

                {minutes ? (
                  <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4 mb-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">
                      <SparklesIcon className="w-3.5 h-3.5" />
                      Agente Gerador de Ata · Gerado por IA
                    </p>
                    <p className="text-sm text-slate-800 leading-relaxed mb-3">{minutes.summary}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs font-semibold text-slate-700 mb-1">Decisões</h3>
                        {minutes.decisions.length > 0 ? (
                          <ul className="list-disc list-inside text-sm text-slate-700 space-y-0.5">
                            {minutes.decisions.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-slate-400">Nenhuma decisão identificada.</p>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-slate-700 mb-1">Pendências</h3>
                        {minutes.pending.length > 0 ? (
                          <ul className="list-disc list-inside text-sm text-slate-700 space-y-0.5">
                            {minutes.pending.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-slate-400">Nenhuma pendência identificada.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mb-3">
                    Sem estruturação automática (sem chave de IA no momento do envio).
                  </p>
                )}

                <details>
                  <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800 select-none">
                    Ver anotações originais
                  </summary>
                  <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{note.rawNotes}</p>
                </details>
              </Card>
            );
          })}
          {company.meetingNotes.length === 0 && (
            <Card className="flex flex-col items-center gap-2 text-center py-12">
              <EmptyBoxIcon className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">Nenhuma ata gerada ainda.</p>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
