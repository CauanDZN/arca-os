"use client";

import { useState } from "react";

type VerticalOption = { key: string; name: string };

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  setup: "Setup Inicial",
  mrr: "Mensalidade (MRR)",
  performance_fee: "Performance Fee",
  projeto_avulso: "Projeto Avulso",
};

const CONTRACT_TYPES = ["setup", "mrr", "performance_fee", "projeto_avulso"] as const;

type Row = { included: boolean; type: (typeof CONTRACT_TYPES)[number]; value: string; feePercent: string };

/**
 * Linha por vertical (checkbox + tipo + valor), com total somado ao vivo —
 * o "Catálogo Comercial Arca modular" do plano estratégico (p. 22), pra
 * montar uma proposta com várias verticais antes de virar Contract.
 * Os <input>/<select> mandam os valores pro <form> pai (que envolve este
 * componente) via `name`; o estado aqui só serve pra desabilitar campo
 * incompatível com o tipo escolhido e somar o total em tela.
 */
export function ProposalRows({ verticals }: { verticals: VerticalOption[] }) {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      verticals.map((v) => [v.key, { included: false, type: "setup", value: "", feePercent: "" } as Row])
    )
  );

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const totals = verticals.reduce(
    (acc, v) => {
      const row = rows[v.key];
      if (!row.included) return acc;
      if (row.type === "setup") acc.setup += Number(row.value) || 0;
      if (row.type === "mrr") acc.mrr += Number(row.value) || 0;
      if (row.type === "projeto_avulso") acc.avulso += Number(row.value) || 0;
      if (row.type === "performance_fee") acc.performanceCount += 1;
      return acc;
    },
    { setup: 0, mrr: 0, avulso: 0, performanceCount: 0 }
  );

  const includedCount = Object.values(rows).filter((r) => r.included).length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2 px-1 w-8"></th>
              <th className="py-2 px-1">Vertical</th>
              <th className="py-2 px-1">Tipo de contrato</th>
              <th className="py-2 px-1">Valor (R$)</th>
              <th className="py-2 px-1">% Performance Fee</th>
            </tr>
          </thead>
          <tbody>
            {verticals.map((v) => {
              const row = rows[v.key];
              return (
                <tr key={v.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 px-1">
                    <input
                      type="checkbox"
                      name={`include_${v.key}`}
                      aria-label={`Incluir ${v.name} na proposta`}
                      checked={row.included}
                      onChange={(e) => update(v.key, { included: e.target.checked })}
                    />
                  </td>
                  <td className="py-2 px-1 font-medium text-slate-800">{v.name}</td>
                  <td className="py-2 px-1">
                    <select
                      name={`type_${v.key}`}
                      value={row.type}
                      disabled={!row.included}
                      onChange={(e) => update(v.key, { type: e.target.value as Row["type"] })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      {CONTRACT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {CONTRACT_TYPE_LABEL[type]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-1">
                    <input
                      type="number"
                      name={`value_${v.key}`}
                      min={0}
                      step="0.01"
                      value={row.value}
                      disabled={!row.included || row.type === "performance_fee"}
                      onChange={(e) => update(v.key, { value: e.target.value })}
                      placeholder={row.type === "performance_fee" ? "—" : "Ex.: 15000"}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                  <td className="py-2 px-1">
                    <input
                      type="number"
                      name={`feePercent_${v.key}`}
                      min={0}
                      max={100}
                      step="0.1"
                      value={row.feePercent}
                      disabled={!row.included || row.type !== "performance_fee"}
                      onChange={(e) => update(v.key, { feePercent: e.target.value })}
                      placeholder={row.type === "performance_fee" ? "Ex.: 10" : "—"}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-sm">
        <p className="font-semibold text-blue-800 mb-1">
          {includedCount === 0
            ? "Nenhuma vertical selecionada ainda."
            : `${includedCount} ${includedCount === 1 ? "vertical selecionada" : "verticais selecionadas"} — total da proposta:`}
        </p>
        {includedCount > 0 && (
          <ul className="text-xs text-blue-900 space-y-0.5">
            {totals.setup > 0 && <li>Setup Inicial: R$ {totals.setup.toLocaleString("pt-BR")} (à vista)</li>}
            {totals.mrr > 0 && <li>Mensalidade (MRR): R$ {totals.mrr.toLocaleString("pt-BR")}/mês</li>}
            {totals.avulso > 0 && <li>Projetos Avulsos: R$ {totals.avulso.toLocaleString("pt-BR")}</li>}
            {totals.performanceCount > 0 && (
              <li>{totals.performanceCount} contrato(s) de Performance Fee — apurado por período</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
