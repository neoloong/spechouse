import type { Metadata } from "next";
import { Suspense } from "react";
import ListingsContent from "@/components/ListingsContent";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Property Listings | SpecHouse",
    description: "Browse and compare properties. View specs, scores, and value analysis.",
    alternates: {
      canonical: "/listings",
    },
    openGraph: {
      title: "Property Listings | SpecHouse",
      description: "Browse and compare properties. View specs, scores, and value analysis.",
      type: "website",
      url: "/listings",
    },
  };
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-64 w-full" /></div>}>
      <ListingsContent />
    </Suspense>
  );
}