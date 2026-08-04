import { PageSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl items-center px-4">
      <div className="w-full">
        <PageSkeleton variante="inicio" />
      </div>
    </main>
  );
}
