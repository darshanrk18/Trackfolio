import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactsView } from "./contacts-view";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ContactsView />
    </Suspense>
  );
}
