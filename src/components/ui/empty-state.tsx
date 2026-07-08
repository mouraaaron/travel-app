"use client"

/**
 * EmptyState — aproximação do molecule `@paggo/fend/components/molecules/empty-state`.
 *
 * API enxuta: title obrigatório; description, icon e button opcionais.
 * Tamanhos: `small` (default, usado em tabs vazias) e `mid` (usado em telas
 * onboarding com mais espaço pra respirar). `tiny` é menos comum mas suportado.
 *
 * O componente é "presentational" — quem chama controla o que acontece no
 * onClick do botão. Não tem estado.
 */
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  size?: 'tiny' | 'small' | 'mid';
  button?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    hierarchy?: 'primary' | 'secondary';
  };
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  size = 'small',
  button,
  className,
}: EmptyStateProps) {
  const padding = size === 'tiny' ? 'p-2' : 'p-10';
  const iconSize = size === 'mid' ? 'size-6' : 'size-5';
  const iconWrapSize = size === 'mid' ? 'size-14' : 'size-12';
  const titleSize =
    size === 'mid'
      ? 'text-lg font-medium'
      : size === 'tiny'
        ? 'text-sm font-medium'
        : 'text-base font-medium';
  const descriptionSize = size === 'tiny' ? 'text-xs' : 'text-sm';

  // transitions-dev texts-reveal (#18): flip to `.is-shown` one frame after
  // mount so the title + description rise in with a staggered blur.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      id="table-empty-state"
      className={cn(
        'flex w-full flex-col items-center gap-3 rounded-md border border-dashed border-zinc-200',
        padding,
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-zinc-100',
            iconWrapSize,
          )}
        >
          <Icon className={cn(iconSize, 'text-zinc-400')} strokeWidth={1.5} />
        </div>
      ) : null}
      <div
        className={cn(
          't-stagger flex max-w-md flex-col items-center gap-1.5 text-center',
          shown && 'is-shown',
        )}
      >
        <h3 className={cn('t-stagger-line leading-tight text-[#18181B]', titleSize)}>
          {title}
        </h3>
        {description ? (
          <p
            className={cn(
              't-stagger-line t-stagger-line--2 leading-relaxed text-[#52525B]',
              descriptionSize,
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {button ? (
        <div className="pt-3">
          <Button
            size="sm"
            onClick={button.onClick}
            variant={button.hierarchy === 'secondary' ? 'outline' : 'default'}
            className={cn(
              button.hierarchy !== 'secondary' &&
                cn(
                  'bg-brand-gradient hover:bg-brand-gradient-hover h-8 gap-1.5 rounded-sm text-[13px] font-normal leading-[18px] text-white',
                  // optical nudge: with a leading icon, icon-side padding = text-side - 2px
                  button.icon ? 'pl-3.5 pr-4' : 'px-4',
                ),
            )}
          >
            {button.icon ? <button.icon className="size-4" /> : null}
            {button.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
