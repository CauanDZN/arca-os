import { createDiagnostic } from "@/app/actions";
import { OBJECTIVES } from "@/lib/areas";

export default function NovoDiagnosticoPage() {
  return (
    <main className="flex-1 bg-slate-50 py-10 px-4">
      <form
        action={createDiagnostic}
        className="mx-auto max-w-3xl bg-white rounded-xl shadow-sm border border-slate-200 p-8"
      >
        <p className="text-sm font-semibold text-blue-700 uppercase mb-1">
          Etapa 1 de 3
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          Cadastro e Contexto do Negócio
        </h1>
        <p className="text-slate-600 mb-8">
          Preencha os dados gerais da empresa. Essas informações contextualizam
          o diagnóstico e o relatório final.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Nome da empresa" name="name" required />
          <Field label="Segmento" name="segment" required />
          <Field label="Tempo de mercado" name="marketAge" placeholder="Ex: 5 anos" />
          <Field
            label="Número de colaboradores"
            name="employees"
            placeholder="Ex: 12"
          />
          <Field
            label="Faturamento mensal médio"
            name="avgRevenue"
            placeholder="Ex: R$ 150.000"
          />
          <Field label="Margem aproximada" name="margin" placeholder="Ex: 18%" />
          <Field
            label="Quantidade de clientes ativos"
            name="activeClients"
            placeholder="Ex: 80"
          />
          <Field
            label="Cidades de atuação"
            name="cities"
            placeholder="Ex: São Paulo, Campinas"
          />
        </div>

        <div className="mt-5">
          <TextAreaField
            label="Principais produtos/serviços"
            name="productsServices"
          />
        </div>

        <div className="mt-5">
          <TextAreaField label="Principais dores atuais" name="painPoints" />
        </div>

        <fieldset className="mt-8">
          <legend className="font-semibold text-slate-900 mb-3">
            Objetivo do diagnóstico
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OBJECTIVES.map((obj) => (
              <label
                key={obj}
                className="flex items-center gap-2 text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <input type="checkbox" name="objectives" value={obj} className="accent-blue-700" />
                {obj}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="mt-8 w-full rounded-lg bg-blue-700 text-white font-semibold py-3 hover:bg-blue-800 transition-colors"
        >
          Iniciar Questionário
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </span>
      <input
        type="text"
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
      />
    </label>
  );
}

function TextAreaField({ label, name }: { label: string; name: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </span>
      <textarea
        name={name}
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
      />
    </label>
  );
}
