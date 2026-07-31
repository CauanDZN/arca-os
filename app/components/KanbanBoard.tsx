"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderTasks, moveTask, updateTaskDetails } from "@/app/actions-project";
import { Badge } from "@/app/components/Badge";
import { SubmitButton } from "@/app/components/SubmitButton";
import { priorityTone } from "@/lib/badge-tones";
import { DragHandleIcon } from "@/app/components/icons";

export type KanbanTask = {
  id: string;
  title: string;
  areaName: string;
  priority: string;
  timeframe: string;
  status: string;
  position: number;
  responsible: string;
  dueDate: Date | null;
  rootCause: string;
  successIndicator: string;
  dependencies: string;
  completionEvidence: string;
  epicId: string | null;
  sprintId: string | null;
  isOverdue: boolean;
  sprintName?: string;
  epicName?: string;
};

type Column = { status: string; title: string; accent: string };
type SimpleOption = { id: string; name: string };

export type KanbanBoardProps = {
  diagnosticId: string;
  columns: Column[];
  initialTasks: KanbanTask[];
  epics: SimpleOption[];
  sprints: SimpleOption[];
};

function groupByStatus(tasks: KanbanTask[], columns: Column[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const col of columns) {
    grouped[col.status] = tasks
      .filter((t) => t.status === col.status)
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id);
  }
  return grouped;
}

export function KanbanBoard({ diagnosticId, columns, initialTasks, epics, sprints }: KanbanBoardProps) {
  const [items, setItems] = useState<Record<string, string[]>>(() =>
    groupByStatus(initialTasks, columns)
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Re-sync whenever the server-rendered data changes (another mutation,
  // another tab, or the server confirming our own optimistic drag) — without
  // this, local drag state would keep showing whatever the last drag left it
  // at, even after e.g. an "Avançar" button click elsewhere refreshes props.
  // Adjusted during render (not an Effect) per the React docs pattern for
  // deriving state from a prop change: https://react.dev/learn/you-might-not-need-an-effect
  const [prevInitialTasks, setPrevInitialTasks] = useState(initialTasks);
  if (initialTasks !== prevInitialTasks) {
    setPrevInitialTasks(initialTasks);
    setItems(groupByStatus(initialTasks, columns));
  }

  const tasksById = useMemo(() => {
    const map = new Map<string, KanbanTask>();
    for (const t of initialTasks) map.set(t.id, t);
    return map;
  }, [initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function findContainer(id: string): string | undefined {
    if (id in items) return id;
    return Object.keys(items).find((key) => items[key].includes(id));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setItems((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const overIndex = overItems.indexOf(overId);
      const newIndex = overId in prev ? overItems.length : overIndex >= 0 ? overIndex : overItems.length;

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== activeId),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          activeId,
          ...overItems.slice(newIndex),
        ],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer) return;

    let finalItems = items;
    if (activeContainer === overContainer) {
      const activeIndex = items[activeContainer].indexOf(activeId);
      const overIndex = items[overContainer].indexOf(overId);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        finalItems = { ...items, [overContainer]: arrayMove(items[overContainer], activeIndex, overIndex) };
        setItems(finalItems);
      }
    }

    const finalStatus = overContainer;
    const orderedIds = finalItems[finalStatus];
    startTransition(() => {
      reorderTasks(diagnosticId, activeId, finalStatus, orderedIds).catch((err) => {
        console.error("failed to persist kanban reorder:", err);
      });
    });
  }

  const activeTask = activeId ? tasksById.get(activeId) : null;

  return (
    <DndContext
      id={`kanban-${diagnosticId}`}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {columns.map((col) => (
          <DroppableColumn key={col.status} column={col} taskCount={items[col.status]?.length ?? 0}>
            <SortableContext items={items[col.status] ?? []} strategy={verticalListSortingStrategy}>
              {(items[col.status] ?? []).map((taskId) => {
                const task = tasksById.get(taskId);
                if (!task) return null;
                return (
                  <SortableTaskCard key={taskId} id={taskId}>
                    <TaskCardContent
                      task={task}
                      diagnosticId={diagnosticId}
                      epics={epics}
                      sprints={sprints}
                      columnStatus={col.status}
                    />
                  </SortableTaskCard>
                );
              })}
            </SortableContext>
            {(items[col.status] ?? []).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">Vazio</p>
            )}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="rounded-lg border border-blue-300 bg-white p-3 shadow-lg rotate-2 cursor-grabbing">
            <TaskCardContent
              task={activeTask}
              diagnosticId={diagnosticId}
              epics={epics}
              sprints={sprints}
              columnStatus={activeTask.status}
              readOnly
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumn({
  column,
  taskCount,
  children,
}: {
  column: Column;
  taskCount: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border p-4 transition-colors ${
        isOver ? "border-blue-300 bg-blue-50/40" : "border-slate-200/80"
      }`}
    >
      <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${column.accent}`} />
        {column.title}
        <span className="ml-auto text-xs font-normal text-slate-400">{taskCount}</span>
      </h2>
      <div ref={setNodeRef} className="space-y-3 min-h-[60px]">
        {children}
      </div>
    </div>
  );
}

function SortableTaskCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar ação"
        className="mt-0.5 shrink-0 touch-none rounded text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
      >
        <DragHandleIcon className="w-4 h-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function TaskCardContent({
  task,
  diagnosticId,
  epics,
  sprints,
  columnStatus,
  readOnly = false,
}: {
  task: KanbanTask;
  diagnosticId: string;
  epics: SimpleOption[];
  sprints: SimpleOption[];
  columnStatus: string;
  readOnly?: boolean;
}) {
  return (
    <>
      <p className="text-xs text-slate-500 mb-1">{task.areaName}</p>
      <p className="text-sm font-medium text-slate-900 mb-1">{task.title}</p>
      {task.rootCause && <p className="text-xs text-slate-500 italic mb-2">Causa: {task.rootCause}</p>}
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <Badge text={task.priority} tone={priorityTone(task.priority)} />
        <span className="text-xs text-slate-400">{task.timeframe}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
        {task.responsible && <span className="text-slate-600">{task.responsible}</span>}
        {task.dueDate && (
          <span className={task.isOverdue ? "font-semibold text-red-600" : "text-slate-500"}>
            {task.isOverdue ? "Atrasada · " : "Prazo: "}
            {new Date(task.dueDate).toLocaleDateString("pt-BR")}
          </span>
        )}
        {task.epicName && (
          <span className="text-slate-700 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
            {task.epicName}
          </span>
        )}
        {task.sprintName && (
          <span className="text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
            {task.sprintName}
          </span>
        )}
      </div>

      {!readOnly && (
        <>
          <details className="mt-2 group">
            <summary className="cursor-pointer text-xs font-medium text-blue-700 select-none">
              + Detalhes
            </summary>
            <form
              action={updateTaskDetails.bind(null, diagnosticId, task.id)}
              className="mt-2 flex flex-col gap-1.5"
            >
              <input
                type="text"
                name="responsible"
                defaultValue={task.responsible}
                placeholder="Responsável"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <input
                type="date"
                name="dueDate"
                defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              {epics.length > 0 && (
                <select
                  name="epicId"
                  defaultValue={task.epicId ?? ""}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
                >
                  <option value="">Sem épico</option>
                  {epics.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              )}
              {sprints.length > 0 && (
                <select
                  name="sprintId"
                  defaultValue={task.sprintId ?? ""}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
                >
                  <option value="">Sem sprint</option>
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                name="successIndicator"
                defaultValue={task.successIndicator}
                placeholder="Indicador de sucesso"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <input
                type="text"
                name="dependencies"
                defaultValue={task.dependencies}
                placeholder="Dependências"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <input
                type="text"
                name="completionEvidence"
                defaultValue={task.completionEvidence}
                placeholder="Evidência de conclusão"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <SubmitButton
                pendingText="Salvando..."
                className="self-start rounded-md bg-slate-800 text-white text-xs font-semibold px-2.5 py-1 hover:bg-slate-900 transition-colors"
              >
                Salvar
              </SubmitButton>
            </form>
          </details>

          <div className="mt-2 flex gap-2">
            {columnStatus !== "todo" && (
              <form action={moveTask.bind(null, diagnosticId, task.id, "backward")}>
                <SubmitButton className="text-xs text-slate-500 hover:text-slate-800 hover:underline disabled:no-underline">
                  ← Voltar
                </SubmitButton>
              </form>
            )}
            {columnStatus !== "done" && (
              <form action={moveTask.bind(null, diagnosticId, task.id, "forward")} className="ml-auto">
                <SubmitButton className="text-xs text-blue-700 hover:underline disabled:no-underline">
                  Avançar →
                </SubmitButton>
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}
