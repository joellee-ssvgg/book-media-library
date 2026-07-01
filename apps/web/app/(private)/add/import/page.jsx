import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import { ImportForm } from "@/components/domain/import-form";

export default function ImportPage() {
  return (
    <div className="page-frame">
      <SectionHeader
        eyebrow="IMPORT"
        title="导入记录"
        action={
          <Link href="/library" className="font-ui text-sm font-medium text-primary hover:underline">
            返回图书库
          </Link>
        }
      />
      <p className="ink-subtitle mt-3 max-w-2xl text-sm">
        上传 CSV（支持 Goodreads 导出）或 MSPF 文件，批量导入到你的库。导入会立即处理，完成后到库里即可看到。
      </p>
      <div className="mt-8">
        <ImportForm />
      </div>
    </div>
  );
}
