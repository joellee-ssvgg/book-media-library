import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateListForm } from "@/components/domain/create-list-form";
import { SectionHeader } from "@/components/ui/section-header";

export default function NewListPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/lists" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        返回清单
      </Link>
      <SectionHeader eyebrow="LISTS" title="新建清单" />
      <CreateListForm />
    </div>
  );
}
