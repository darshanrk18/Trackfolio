"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { STATUS_LABELS, FUNNEL_STAGES, isActiveStatus } from "@/lib/pipeline";
import { daysSince, downloadBlob, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/server/db/schema";

const STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];
const BOARD = [...FUNNEL_STAGES, "rejected", "withdrawn"] as ApplicationStatus[];

export function ApplicationsView() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | ApplicationStatus>("all");
  const [company, setCompany] = React.useState("");
  const [role, setRole] = React.useState("");
  const [date, setDate] = React.useState("");
  const [newStatus, setNewStatus] = React.useState<ApplicationStatus>("applied");

  const list = useQuery(
    trpc.applications.list.queryOptions({
      search: search || undefined,
      status: status === "all" ? undefined : status,
    }),
  );
  const csv = useQuery({
    ...trpc.data.exportApplicationsCsv.queryOptions(),
    enabled: false,
  });

  const invalidate = () => {
    void qc.invalidateQueries(trpc.applications.pathFilter());
    void qc.invalidateQueries(trpc.insights.pathFilter());
  };

  const create = useMutation(
    trpc.applications.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        setCompany("");
        setRole("");
        toast.success("Application added");
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const updateStatus = useMutation(
    trpc.applications.updateStatus.mutationOptions({
      onSuccess: invalidate,
      onError: (err) => toast.error(err.message),
    }),
  );
  const update = useMutation(
    trpc.applications.update.mutationOptions({
      onSuccess: invalidate,
      onError: (err) => toast.error(err.message),
    }),
  );
  const remove = useMutation(
    trpc.applications.delete.mutationOptions({
      onSuccess: (deleted) => {
        invalidate();
        toast.success(`Deleted ${deleted.company}`, {
          action: {
            label: "Undo",
            onClick: () =>
              restore.mutate({
                application: {
                  ...deleted,
                  tags: deleted.tags ?? [],
                  interviewPrep: deleted.interviewPrep ?? {},
                },
              }),
          },
        });
      },
    }),
  );
  const restore = useMutation(
    trpc.applications.restore.mutationOptions({
      onSuccess: invalidate,
    }),
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const over = event.over?.id;
    const id = event.active.id;
    if (!over || typeof over !== "string" || typeof id !== "string") return;
    if (!STATUSES.includes(over as ApplicationStatus)) return;
    updateStatus.mutate({ id, status: over as ApplicationStatus });
  };

  const rows = list.data ?? [];

  return (
    <>
      <PageHeader
        title="Applications"
        description="Every submission — freeze stamp, days silent, and the next interview, on the board or in the table."
      />

      <form
        className="mb-4 grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!company.trim()) return;
          create.mutate({
            company: company.trim(),
            role,
            appliedOn: date || undefined,
            status: newStatus,
          });
        }}
      >
        <Field label="Company" htmlFor="f-company" required>
          <Input id="f-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Stripe" />
        </Field>
        <Field label="Role" htmlFor="f-role">
          <Input id="f-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Backend SDE" />
        </Field>
        <Field label="Date" htmlFor="f-date">
          <Input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Status" htmlFor="f-status">
          <NativeSelect
            id="f-status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button variant="primary" type="submit" loading={create.isPending}>
          Add
        </Button>
      </form>

      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company or role…"
          className="min-w-[200px]"
        />
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            const result = await csv.refetch();
            if (result.data) {
              downloadBlob(result.data.csv, "applications.csv", "text/csv");
            }
          }}
        >
          Export CSV
        </Button>
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>
        <TabsContent value="table" className="mt-3">
          {list.isPending ? (
            <Skeleton className="h-64" />
          ) : list.error ? (
            <ErrorState onRetry={() => void list.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="No applications yet." description="Add your first above." />
          ) : (
            <div className="border-line overflow-x-auto rounded-[8px] border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-ink-3 text-left font-mono text-[9.5px] tracking-wide">
                    <th className="border-line border-b px-2 py-2">COMPANY</th>
                    <th className="border-line border-b px-2 py-2">ROLE</th>
                    <th className="border-line border-b px-2 py-2">DATE</th>
                    <th className="border-line border-b px-2 py-2">STATUS</th>
                    <th className="border-line border-b px-2 py-2">STATE</th>
                    <th className="border-line border-b px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const stale =
                      isActiveStatus(row.status) &&
                      (daysSince(row.appliedOn) ?? 0) >= 14;
                    return (
                      <tr
                        key={row.id}
                        className={stale ? "shadow-[inset_2px_0_0_var(--warn)]" : undefined}
                      >
                        <td className="border-line border-b px-2 py-2 font-medium">
                          {row.company}
                        </td>
                        <td className="border-line border-b px-2 py-2">{row.role || "—"}</td>
                        <td className="border-line border-b px-2 py-2 font-mono text-[12px]">
                          {formatDate(row.appliedOn, "short")}
                          {stale && (
                            <div className="text-warn font-mono text-[9.5px]">
                              {daysSince(row.appliedOn)}d no update
                            </div>
                          )}
                        </td>
                        <td className="border-line border-b px-2 py-2">
                          <NativeSelect
                            value={row.status}
                            onChange={(e) =>
                              update.mutate({
                                id: row.id,
                                status: e.target.value as ApplicationStatus,
                              })
                            }
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABELS[s]}
                              </option>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="border-line border-b px-2 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Badge tone={row.frozen ? "ok" : "bad"} size="sm" mono>
                              {row.frozen ? "FROZEN" : "HOLE"}
                            </Badge>
                            <Badge tone={row.jdArchived ? "ok" : "warn"} size="sm" mono>
                              {row.jdArchived ? "JD" : "NO JD"}
                            </Badge>
                          </div>
                        </td>
                        <td className="border-line border-b px-2 py-2 whitespace-nowrap">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/applications/${row.id}`}>Open</Link>
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Delete ${row.company}?`)) remove.mutate({ id: row.id });
                            }}
                          >
                            Del
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="board" className="mt-3">
          {list.isPending ? (
            <Skeleton className="h-64" />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {BOARD.map((col) => (
                  <BoardColumn
                    key={col}
                    status={col}
                    items={rows.filter((r) => r.status === col)}
                    onOpen={(id) => router.push(`/applications/${id}`)}
                  />
                ))}
              </div>
            </DndContext>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

type BoardItem = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  appliedOn: string | null;
  updatedAt: Date;
  interviewOn: Date | null;
  frozen: boolean;
  jdArchived: boolean;
};

function BoardColumn({
  status,
  items,
  onOpen,
}: {
  status: ApplicationStatus;
  items: BoardItem[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className="bg-sunken w-[240px] shrink-0 rounded-[8px] p-2"
      style={{ outline: isOver ? "2px solid var(--primary)" : undefined }}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <StatusPill status={status} />
        <span className="text-ink-3 font-mono text-[10px]">{items.length}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <BoardCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function BoardCard({
  item,
  onOpen,
}: {
  item: BoardItem;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });
  const silent =
    daysSince(item.updatedAt) ?? daysSince(item.appliedOn) ?? 0;
  const heat = silent >= 21 ? "bad" : silent >= 14 ? "warn" : null;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(item.id)}
      className="border-line bg-surface w-full rounded-[7px] border px-2.5 py-2 text-left"
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
        boxShadow: heat
          ? `inset 3px 0 0 var(--${heat})`
          : undefined,
      }}
      {...listeners}
      {...attributes}
    >
      <div className="mb-1 flex items-start justify-between gap-1">
        <p className="truncate text-[12.5px] font-semibold">{item.company}</p>
        <StatusPill status={item.status} />
      </div>
      <p className="text-ink-3 truncate text-[11px]">{item.role || "Role"}</p>
      <p className="readout text-ink-3 mt-1.5 flex flex-wrap gap-x-2 text-[9.5px]">
        <span className={heat === "bad" ? "text-bad" : heat === "warn" ? "text-warn" : undefined}>
          {silent}d silent
        </span>
        <span className={item.frozen ? "text-ok" : "text-bad"}>
          {item.frozen ? "frozen" : "not frozen"}
        </span>
        <span className={item.jdArchived ? "text-ok" : "text-warn"}>
          {item.jdArchived ? "JD in" : "no JD"}
        </span>
        {item.interviewOn && (
          <span className="text-primary">
            int {formatDate(item.interviewOn, "short")}
          </span>
        )}
      </p>
    </button>
  );
}
