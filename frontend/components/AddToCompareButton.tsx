"use client";

import { useCompare } from "@/hooks/useCompare";
import { Button } from "@/components/ui/button";
import { GitCompareArrows, Check, Plus } from "lucide-react";

export default function AddToCompareButton({ propertyId }: { propertyId: number }) {
  const { isSelected, toggle, canAdd } = useCompare();
  const selected = isSelected(propertyId);

  return (
    <Button
      size="sm"
      variant={selected ? "default" : "outline"}
      onClick={() => toggle(propertyId)}
      disabled={!selected && !canAdd(propertyId)}
    >
      {selected ? (
        <>
          <Check className="w-4 h-4 mr-1" />
          In compare
        </>
      ) : (
        <>
          <GitCompareArrows className="w-4 h-4 mr-1" />
          Add to compare
        </>
      )}
    </Button>
  );
}
