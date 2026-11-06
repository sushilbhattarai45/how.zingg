import Link from 'next/link';

type Variant = 'primary' | 'secondary' | 'ghost';

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-5 text-[15px] font-bold transition-colors duration-150 disabled:cursor-not-allowed';
const variants: Record<Variant, string> = {
  // One green primary per screen (DESIGN.md §3): ink text on green, never white.
  primary:
    'bg-window text-ink hover:bg-window-hi active:bg-window-hi disabled:bg-raised disabled:text-text-3',
  secondary: 'border border-line bg-transparent text-chalk hover:bg-raised',
  ghost: 'bg-transparent text-text-2 hover:text-chalk',
};

export function buttonClass(variant: Variant = 'primary', extra = '') {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  href,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; href: string }) {
  return <Link href={href} className={buttonClass(variant, className)} {...props} />;
}
