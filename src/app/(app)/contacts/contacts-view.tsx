"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { daysSince, formatDate } from "@/lib/utils";

export function ContactsView() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const highlight = useSearchParams().get("id");
  const [name, setName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [relation, setRelation] = React.useState("");
  const [date, setDate] = React.useState("");
  const [linkedin, setLinkedin] = React.useState("");
  const [search, setSearch] = React.useState("");

  const list = useQuery(
    trpc.contacts.list.queryOptions({ search: search || undefined }),
  );

  const invalidate = () => {
    void qc.invalidateQueries(trpc.contacts.pathFilter());
    void qc.invalidateQueries(trpc.insights.pathFilter());
  };

  const create = useMutation(
    trpc.contacts.create.mutationOptions({
      onSuccess: () => {
        invalidate();
        setName("");
        setCompany("");
        setRelation("");
        setDate("");
        setLinkedin("");
        toast.success("Contact added");
      },
      onError: (err) => toast.error(err.message),
    }),
  );
  const update = useMutation(
    trpc.contacts.update.mutationOptions({
      onSuccess: invalidate,
      onError: (err) => toast.error(err.message),
    }),
  );
  const remove = useMutation(
    trpc.contacts.delete.mutationOptions({
      onSuccess: (deleted) => {
        invalidate();
        toast.success(`Deleted ${deleted.name}`, {
          action: {
            label: "Undo",
            onClick: () => restore.mutate({ contact: deleted }),
          },
        });
      },
    }),
  );
  const restore = useMutation(
    trpc.contacts.restore.mutationOptions({ onSuccess: invalidate }),
  );

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Recruiters, referrals, and networking contacts tied to your search."
      />
      <form
        className="mb-4 grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.1fr_1fr_0.9fr_1.1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate({
            name: name.trim(),
            company: company || undefined,
            relation: relation || undefined,
            lastContactedOn: date || undefined,
            linkedinUrl: linkedin || undefined,
          });
        }}
      >
        <Field label="Name" htmlFor="c-name" required>
          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        </Field>
        <Field label="Company" htmlFor="c-company">
          <Input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Stripe" />
        </Field>
        <Field label="Relation" htmlFor="c-relation">
          <Input id="c-relation" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Recruiter" />
        </Field>
        <Field label="Last contact" htmlFor="c-date">
          <Input id="c-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="LinkedIn" htmlFor="c-li">
          <Input id="c-li" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://…" />
        </Field>
        <Button variant="primary" type="submit" loading={create.isPending}>
          Add
        </Button>
      </form>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search contacts…"
        className="mb-3 max-w-xs"
      />

      {list.isPending ? (
        <Skeleton className="h-48" />
      ) : list.error ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState title="No contacts yet." />
      ) : (
        <div className="border-line overflow-x-auto rounded-[8px] border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-ink-3 text-left font-mono text-[9.5px] tracking-wide">
                <th className="border-line border-b px-2 py-2">NAME</th>
                <th className="border-line border-b px-2 py-2">COMPANY</th>
                <th className="border-line border-b px-2 py-2">RELATION</th>
                <th className="border-line border-b px-2 py-2">LAST CONTACT</th>
                <th className="border-line border-b px-2 py-2">LINKEDIN</th>
                <th className="border-line border-b px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.data.map((c) => {
                const age = daysSince(c.lastContactedOn);
                return (
                  <tr
                    key={c.id}
                    className={highlight === c.id ? "bg-primary-soft" : undefined}
                  >
                    <td className="border-line border-b px-2 py-2">
                      <input
                        className="w-full bg-transparent"
                        defaultValue={c.name}
                        onBlur={(e) =>
                          e.target.value !== c.name &&
                          update.mutate({ id: c.id, name: e.target.value })
                        }
                      />
                    </td>
                    <td className="border-line border-b px-2 py-2">
                      <input
                        className="w-full bg-transparent"
                        defaultValue={c.company ?? ""}
                        onBlur={(e) => update.mutate({ id: c.id, company: e.target.value })}
                      />
                    </td>
                    <td className="border-line border-b px-2 py-2">
                      <input
                        className="w-full bg-transparent"
                        defaultValue={c.relation ?? ""}
                        onBlur={(e) => update.mutate({ id: c.id, relation: e.target.value })}
                      />
                    </td>
                    <td className="border-line border-b px-2 py-2">
                      {formatDate(c.lastContactedOn, "short")}
                      {age != null && age >= 30 && (
                        <div className="text-warn font-mono text-[9.5px]">{age}d ago</div>
                      )}
                    </td>
                    <td className="border-line border-b px-2 py-2">
                      {c.linkedinUrl ? (
                        <a
                          href={c.linkedinUrl}
                          className="text-primary truncate underline-offset-2 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Profile
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="border-line border-b px-2 py-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${c.name}?`)) remove.mutate({ id: c.id });
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
    </>
  );
}
