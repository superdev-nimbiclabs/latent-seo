import { useCallback } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

interface ToastOptions {
  duration?: number;
  isError?: boolean;
}

/**
 * Hook for showing toast notifications with consistent styling
 */
export function useToast() {
  const shopify = useAppBridge();

  const showToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      shopify.toast.show(message, {
        duration: options.duration || 3000,
        isError: options.isError,
      });
    },
    [shopify]
  );

  const showSuccess = useCallback(
    (message: string) => {
      showToast(message, { isError: false });
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string) => {
      showToast(message, { isError: true });
    },
    [showToast]
  );

  return {
    show: showToast,
    success: showSuccess,
    error: showError,
  };
}

/**
 * Common toast messages used throughout the app
 */
export const TOAST_MESSAGES = {
  // Save operations
  saveSuccess: "Changes saved successfully",
  saveFailed: "Failed to save changes. Please try again.",

  // SEO operations
  optimizationStarted: "Optimization job started! Check the dashboard for progress.",
  optimizationComplete: (count: number) => `Optimization complete: ${count} items processed`,
  optimizationFailed: "Optimization failed. Please try again.",

  // Undo operations
  undoSuccess: "Changes reverted successfully",
  undoFailed: "Failed to revert changes. Please try again.",

  // Product operations
  productUpdated: "Product SEO updated successfully",
  productUpdateFailed: "Failed to update product SEO",

  // Export operations
  exportReady: "Export ready for download",
  exportFailed: "Failed to export data",

  // API operations
  apiKeyUpdated: "API key updated successfully",
  apiKeyInvalid: "Invalid API key. Please check and try again.",

  // Generic
  copied: "Copied to clipboard",
  connectionError: "Connection error. Please check your internet connection.",
  rateLimitError: "Too many requests. Please wait a moment and try again.",
} as const;
