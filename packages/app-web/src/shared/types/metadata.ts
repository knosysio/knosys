interface FieldDescriptor {
  readonly name: string;
  readonly label: string;
  readonly type?: string;
  readonly required?: boolean;
}

export type { FieldDescriptor };
