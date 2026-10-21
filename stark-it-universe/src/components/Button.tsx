import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icons';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface Common {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconEnd?: IconName;
  children: ReactNode;
  className?: string;
}

type AsLink = Common & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>;
type AsButton = Common & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

/**
 * Buttons and button-styled links. Main buttons are 48 px tall, the rest
 * at least 44 px. Uses <a> when given an href so it works without JS.
 */
export function Button(props: AsLink | AsButton) {
  const { variant = 'primary', size = 'md', icon, iconEnd, children, className = '' } = props;
  const cls = `btn btn--${variant} btn--${size} ${className}`;
  const inner = (
    <>
      {icon && <Icon name={icon} size={20} />}
      <span className="btn__label">{children}</span>
      {iconEnd && <Icon name={iconEnd} size={20} className="btn__end" />}
    </>
  );

  if (props.href !== undefined) {
    const { variant: _v, size: _s, icon: _i, iconEnd: _e, children: _c, className: _cn, ...rest } = props as AsLink;
    return (
      <a {...rest} className={cls}>
        {inner}
      </a>
    );
  }
  const { variant: _v, size: _s, icon: _i, iconEnd: _e, children: _c, className: _cn, type = 'button', ...rest } =
    props as AsButton;
  return (
    <button {...rest} type={type} className={cls}>
      {inner}
    </button>
  );
}
