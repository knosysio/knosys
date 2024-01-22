import type { FieldDescriptor } from '../../../../types';

interface FormViewWidgetProps {
  readonly className?: string;
  readonly fields: FieldDescriptor[];
  readonly value?: Record<string, any>;
}

export type { FormViewWidgetProps };
