import React from "react";

type ButtonVariant = "default" | "outline" | "destructive" | "ghost";
type ButtonSize = "default" | "sm" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const getVariantClasses = (variant: ButtonVariant = "default"): string => {
  const variants = {
    default: "bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700",
    outline: "border border-gray-600 text-gray-200 bg-transparent hover:bg-gray-700",
    destructive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
    ghost: "text-gray-200 hover:bg-gray-700 bg-transparent",
  };
  return variants[variant];
};

const getSizeClasses = (size: ButtonSize = "default"): string => {
  const sizes = {
    default: "px-4 py-2 text-sm",
    sm: "px-3 py-1.5 text-xs",
    lg: "px-6 py-3 text-base",
    icon: "w-10 h-10 p-0",
  };
  return sizes[size];
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild, children, variant = "default", size = "default", className = "", ...props }, ref) => {
    const Component = asChild ? "span" : "button";

    return (
      <Component
        ref={ref}
        className={`rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getSizeClasses(size)} ${getVariantClasses(variant)} ${className}`}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Button.displayName = "Button";