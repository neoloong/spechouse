import type { Metadata } from "next";
import ListingsContent from "@/components/ListingsContent";

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
  return <ListingsContent />;
}