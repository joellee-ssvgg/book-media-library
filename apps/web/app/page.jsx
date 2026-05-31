import LandingPage from "./(public)/page";
import { PublicTopbar } from "@/components/layout/public-topbar";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicTopbar rightHref="/dashboard" rightLabel="进入阅迹" />
      <LandingPage />
    </div>
  );
}
