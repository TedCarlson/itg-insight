import DirectorWorkspacePageShell from "@/features/role-director/pages/DirectorWorkspacePageShell";

type PageProps = {
  searchParams?: Promise<{
    range?: string;
    dimension?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;

  return (
    <DirectorWorkspacePageShell
      range={searchParams?.range}
      dimension={searchParams?.dimension}
    />
  );
}
