import * as React from "react";
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "md" | "lg";
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-md brand-ring ring-offset-1 transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-[var(--brand-blue)] text-white hover:bg-[color-mix(in_oklab,var(--brand-blue)_85%,black)]",
  outline:
    "border border-[color-mix(in_oklab,var(--brand-blue)_65%,var(--brand-brown))] text-[var(--brand-blue)] hover:bg-[color-mix(in_oklab,white_90%,var(--brand-blue))]",
  ghost: "bg-transparent hover:bg-black/5",
  secondary:
    "bg-[var(--brand-brown)] text-white hover:bg-[color-mix(in_oklab,var(--brand-brown)_85%,black)]",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export default Button;
