import Link from "next/link";
import { BookAddClient } from "@/components/domain/book-add-client";
import { searchBookCandidates } from "@/lib/books/search";
import { SectionHeader } from "@/components/ui/section-header";

function firstParam(value) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AddBookPage({ searchParams }) {
    const params = await searchParams;
    const query = firstParam(params.q).trim();
    const { candidates, notices } = await searchBookCandidates(query);
    return (
      <div className="page-frame">
        <SectionHeader
          eyebrow="ADD BOOK"
          title="添加书籍"
          action={
            <Link href="/library" className="font-ui text-sm font-medium text-primary hover:underline">
              返回图书库
            </Link>
          }
        />
        <p className="ink-subtitle mt-3 max-w-2xl text-sm">
          详细添加：搜索后可为每个结果单独设置初始阅读状态，再加入你的库。只想快速添加，可用顶部的搜索弹窗。
        </p>
        <div className="mt-8">
          <BookAddClient candidates={candidates} notices={notices} query={query} />
        </div>
      </div>
    );
}
