// app/dashboard/page.tsx
import { redirect } from "next/navigation";

export default function DashboardIndexPage() {
  redirect("/dashboard/scripts");
}
