import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListPlus } from "lucide-react";

export default async function ListDetailPage({ params }) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <SectionHeader eyebrow="LIST" title={`清单 #${id}`} />
      <div className="mt-8">
        <EmptyState
          icon={ListPlus}
          title="清单暂无条目"
          description="返回库中将作品加入这个清单。"
        />
      </div>
    </div>
  );
}
