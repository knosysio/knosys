import type { PropsWithChildren } from 'react';

type ViewWrapperControlProps = PropsWithChildren<{
  readonly className?: string;
  readonly loading?: boolean;
}>;

export type { ViewWrapperControlProps };
