import type { ReactElement, ReactNode } from 'react';
import { Button, Popover, Tooltip } from '@heroui/react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
export function InformationPopover({ container, label, children }: { container: HTMLElement; label: string; children: ReactNode }): ReactElement {
  return <Popover><Button variant="secondary">{label}</Button><Popover.Content UNSTABLE_portalContainer={container} placement="bottom end" className="max-w-[min(24rem,calc(100vw-24px))] p-4"><Popover.Dialog aria-label={label}><Popover.Heading className="mb-2 font-semibold">{label}</Popover.Heading>{children}</Popover.Dialog></Popover.Content></Popover>;
}
export function HelpTooltip({ container, label, children }: { container: HTMLElement; label: string; children: ReactNode }): ReactElement {
  return <Tooltip delay={200}><Button aria-label={label} isIconOnly variant="ghost" size="sm"><InformationCircleIcon className="size-5" /></Button><Tooltip.Content UNSTABLE_portalContainer={container} className="max-w-64 p-3">{children}</Tooltip.Content></Tooltip>;
}
