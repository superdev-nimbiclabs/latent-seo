import { useEffect, useCallback } from "react";

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
}

/**
 * Hook for registering keyboard shortcuts
 * @param shortcuts Array of shortcut definitions
 * @param enabled Whether shortcuts are active (default: true)
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutHandler[],
  enabled = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * Common keyboard shortcuts for product selection
 */
export function useProductSelectionShortcuts({
  onSelectAll,
  onDeselectAll,
  onRefresh,
}: {
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onRefresh?: () => void;
}) {
  const shortcuts: ShortcutHandler[] = [];

  if (onSelectAll) {
    shortcuts.push({
      key: "a",
      ctrl: true,
      handler: onSelectAll,
      description: "Select all products",
    });
  }

  if (onDeselectAll) {
    shortcuts.push({
      key: "Escape",
      handler: onDeselectAll,
      description: "Deselect all",
    });
  }

  if (onRefresh) {
    shortcuts.push({
      key: "r",
      ctrl: true,
      handler: onRefresh,
      description: "Refresh data",
    });
  }

  useKeyboardShortcuts(shortcuts);
}

/**
 * Keyboard shortcut for save action
 */
export function useSaveShortcut(onSave: () => void, enabled = true) {
  useKeyboardShortcuts(
    [
      {
        key: "s",
        ctrl: true,
        handler: onSave,
        description: "Save changes",
      },
    ],
    enabled
  );
}

/**
 * Keyboard shortcut for search focus
 */
export function useSearchFocusShortcut(
  searchInputRef: React.RefObject<HTMLInputElement>
) {
  useKeyboardShortcuts([
    {
      key: "k",
      ctrl: true,
      handler: () => searchInputRef.current?.focus(),
      description: "Focus search",
    },
    {
      key: "/",
      handler: () => searchInputRef.current?.focus(),
      description: "Focus search",
    },
  ]);
}
