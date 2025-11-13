import * as React from "react"

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode
  value?: string
  onValueChange?: (value: string) => void
}

interface SelectOptionProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  children: React.ReactNode
}

interface SelectTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  children: React.ReactNode
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ children, className = "", value, onValueChange, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`
          flex h-10 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm 
          text-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 
          focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed 
          disabled:opacity-50 ${className}
        `}
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"

const SelectOption = React.forwardRef<HTMLOptionElement, SelectOptionProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <option
        ref={ref}
        className={className}
        {...props}
      >
        {children}
      </option>
    )
  }
)
SelectOption.displayName = "SelectOption"

const SelectTrigger = React.forwardRef<HTMLDivElement, SelectTriggerProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex h-10 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ placeholder, className = "", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`text-gray-400 ${className}`}
        {...props}
      >
        {placeholder}
      </span>
    )
  }
)
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-gray-700 border border-gray-600 rounded-md ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ value, children, className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-3 py-2 text-sm text-white hover:bg-gray-600 cursor-pointer ${className}`}
        data-value={value}
        {...props}
      >
        {children}
      </div>
    )
  }
)
SelectItem.displayName = "SelectItem"

export { Select, SelectOption, SelectTrigger, SelectValue, SelectContent, SelectItem }
