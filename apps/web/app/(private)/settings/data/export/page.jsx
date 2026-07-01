import Link from "next/link";
import { DataSettingsClient } from "@/components/domain/data-settings-client";

export default function DataExportSettingsPage() {
  return (
    <div className="page-frame">
      <main className="min-w-0">
        <p className="ink-eyebrow">ACCOUNT &amp; DATA</p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">账号与数据</h1>
        <p className="ink-subtitle mt-3 text-lg">你的记录永远属于你。随时打包带走，或与阅迹好好告别。</p>

        <nav className="media-tabs mt-8" aria-label="设置分区">
          <Link className="media-tab" href="/settings/public">公开主页</Link>
          <span className="media-tab">个人资料</span>
          <span className="media-tab">隐私</span>
          <span className="media-tab media-tab-active">账号与数据</span>
        </nav>

        <div className="mt-8">
          <DataSettingsClient />
        </div>
      </main>
    </div>
  );
}
