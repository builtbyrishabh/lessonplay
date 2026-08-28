import { cn } from "~/lib/utils";

type LogoProps = { className?: string };

export function LogoMark({ className }: LogoProps) {
  return (
    <svg
      className={className}
      fill="none"
      role="img"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>LessonPlay</title>
      <path
        clipRule="evenodd"
        d="M11.5 4C10.672 4 10 4.672 10 5.5S10.672 7 11.5 7H12V10.602L5.361 22.804C3.983 25.336 5.816 28.42 8.699 28.42H23.301C26.184 28.42 28.017 25.336 26.639 22.804L20 10.602V7H20.5C21.328 7 22 6.328 22 5.5S21.328 4 20.5 4H11.5ZM13.25 16.72V24.28L19.82 20.5L13.25 16.72Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function Logo({ className }: LogoProps) {
  return (
    <span
      aria-label="LessonPlay"
      className={cn("inline-flex min-w-0 items-center gap-2", className)}
    >
      <LogoMark className="size-6 shrink-0" />
      <span aria-hidden="true" className="truncate">
        LessonPlay
      </span>
    </span>
  );
}
