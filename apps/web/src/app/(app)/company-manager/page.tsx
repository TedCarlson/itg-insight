import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{
    range?: string;
    class_type?: string;
  }>;
};

function normalizeClassType(value: string | undefined): "NSR" | "SMART" {
  return String(value ?? "NSR").trim().toUpperCase() === "SMART"
    ? "SMART"
    : "NSR";
}

function normalizeRange(value: string | undefined): "FM" | "PREVIOUS" | "3FM" | "12FM" {
  const upper = String(value ?? "FM").trim().toUpperCase();
  if (upper === "PREVIOUS") return "PREVIOUS";
  if (upper === "3FM") return "3FM";
  if (upper === "12FM") return "12FM";
  return "FM";
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;

  const class_type = normalizeClassType(searchParams?.class_type);
  const range = normalizeRange(searchParams?.range);

  redirect(`/company-manager/metrics?class_type=${class_type}&range=${range}`);
}