import { useState, useCallback } from "react";

interface UseProductSelectionResult {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  selectedCount: number;
  getSelectedArray: () => string[];
}

export function useProductSelection(): UseProductSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      // If all are selected, deselect all
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      // Otherwise, select all
      return new Set(ids);
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const getSelectedArray = useCallback(
    () => Array.from(selectedIds),
    [selectedIds]
  );

  return {
    selectedIds,
    isSelected,
    toggle,
    selectAll,
    clearSelection,
    selectedCount: selectedIds.size,
    getSelectedArray,
  };
}
