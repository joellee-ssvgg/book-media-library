"use client";
import { useEffect, useState } from "react";
export function OfflineSubmitButton({ children, pending = false, pendingLabel = "提交中", className = "ink-button h-10 px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60", }) {
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
    return (<div className="grid gap-2">
      <button className={className} disabled={disabled} type="submit">
        {pending ? pendingLabel : children}
      </button>
      {!online ? (<p className="font-ui text-xs text-[var(--danger)]">离线时写入已禁用，请联网后再提交。</p>) : null}
    </div>);
}
