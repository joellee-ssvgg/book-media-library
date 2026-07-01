"use client";
import { useEffect } from "react";

async function clearDevelopmentServiceWorkers() {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
    }
}

export function PwaRuntime() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) {
            return;
        }

        if (process.env.NODE_ENV !== "production") {
            clearDevelopmentServiceWorkers().catch(() => undefined);
            return;
        }

        const register = () => {
            navigator.serviceWorker
                .register("/sw.js", { scope: "/", updateViaCache: "none" })
                .then((registration) => registration.update().catch(() => undefined))
                .catch(() => undefined);
        };
        if (document.readyState === "complete") {
            register();
            return;
        }
        window.addEventListener("load", register, { once: true });
        return () => window.removeEventListener("load", register);
    }, []);
    return null;
}
