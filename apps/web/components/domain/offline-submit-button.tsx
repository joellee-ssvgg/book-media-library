"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type OfflineSubmitButtonProps = {
  children: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
  className?: string;
};

export function OfflineSubmitButton({
  children,
  pending = false,
  pendingLabel = "提交中",
  className = "h-10 bg-[#1f3d35] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60",
}: OfflineSubmitButtonProps) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const disabled = pending || !online;

  return (
    <div className="grid gap-2">
      <button className={className} disabled={disabled} type="submit">
        {pending ? pendingLabel : children}
      </button>
      {!online ? (
        <p className="text-xs text-[#9a3412]">离线时写入已禁用，请联网后再提交。</p>
      ) : null}
    </div>
  );
}
