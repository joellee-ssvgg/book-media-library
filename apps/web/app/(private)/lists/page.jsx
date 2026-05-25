import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListPlus, Plus } from "lucide-react";

export default function ListsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <SectionHeader
        eyebrow="LISTS"
        title="我的清单"
        action={
          <Button size="sm">
            <Plus className="size-4" />新建清单
          </Button>
        }
      />
      <div className="mt-8">
        <EmptyState
          icon={ListPlus}
          title="还没有创建清单"
          description="创建你的第一个策展集合，整理你最喜欢的书和电影。"
          action={<Button size="sm" variant="outline"><Plus className="size-4" />新建清单</Button>}
        />
      </div>
    </div>
  );
}
