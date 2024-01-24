interface FieldDescriptor {
  readonly name: string;
  readonly label: string;
  readonly type?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly hint?: string;
}

export type { FieldDescriptor };
