import { notFound } from "next/navigation";
import { RouteModal } from "@/components/ui/route-modal";
import { WorkContent } from "@/components/work/work-content";
import { getAllWorks, getWorkBySlug } from "@/lib/works";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllWorks().map((work) => ({ slug: work.slug }));
}

export default async function WorkModal({ params }: Props) {
  const { slug } = await params;
  const work = getWorkBySlug(slug);

  if (!work) notFound();

  return (
    <RouteModal>
      <WorkContent work={work} />
    </RouteModal>
  );
}
