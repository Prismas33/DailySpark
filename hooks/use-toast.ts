import { useState } from "react";

interface Toast {
  title: string;
  description: string;
  variant?: "default" | "success" | "destructive";
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (newToast: Toast) => {
    setToasts((prevToasts) => [...prevToasts, newToast]);
  };

  return { toast, toasts };
}