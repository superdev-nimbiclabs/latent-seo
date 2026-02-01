import { Filters, ChoiceList } from "@shopify/polaris";
import { useState, useCallback } from "react";
import type { FilterOption } from "../../types/seo";

interface FilterBarProps {
  selectedFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchClear: () => void;
}

const FILTER_OPTIONS = [
  { label: "All Products", value: "all" },
  { label: "Missing Title", value: "missing_title" },
  { label: "Missing Description", value: "missing_meta" },
  { label: "Fully Optimized", value: "optimized" },
];

export function FilterBar({
  selectedFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onSearchClear,
}: FilterBarProps) {
  const [queryValue, setQueryValue] = useState(searchQuery);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQueryValue(value);
      onSearchChange(value);
    },
    [onSearchChange]
  );

  const handleQueryClear = useCallback(() => {
    setQueryValue("");
    onSearchClear();
  }, [onSearchClear]);

  const handleFilterChange = useCallback(
    (selected: string[]) => {
      onFilterChange((selected[0] || "all") as FilterOption);
    },
    [onFilterChange]
  );

  const handleFiltersClearAll = useCallback(() => {
    onFilterChange("all");
    handleQueryClear();
  }, [onFilterChange, handleQueryClear]);

  const filters = [
    {
      key: "seoStatus",
      label: "SEO Status",
      filter: (
        <ChoiceList
          title="SEO Status"
          titleHidden
          choices={FILTER_OPTIONS}
          selected={[selectedFilter]}
          onChange={handleFilterChange}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters =
    selectedFilter !== "all"
      ? [
          {
            key: "seoStatus",
            label: FILTER_OPTIONS.find((o) => o.value === selectedFilter)?.label || "",
            onRemove: () => onFilterChange("all"),
          },
        ]
      : [];

  return (
    <Filters
      queryValue={queryValue}
      queryPlaceholder="Search products..."
      filters={filters}
      appliedFilters={appliedFilters}
      onQueryChange={handleQueryChange}
      onQueryClear={handleQueryClear}
      onClearAll={handleFiltersClearAll}
    />
  );
}
