import { useState } from 'react';
import { Form, Input, Button } from 'antd';
import type { FormRule } from 'antd/es';

import type { FieldDescriptor } from '../../../../types';
import type { FormViewWidgetProps } from './typing';

function resolveFieldRules(field: FieldDescriptor): FormRule[] {
  const resolved: FormRule[] = [];

  if (field.required) {
    resolved.push({ required: field.required });
  }

  return resolved;
}

function resolveFieldNode(field: FieldDescriptor) {
  const { type } = field;

  if (!type || type === 'string') {
    return <Input placeholder={`请输入${field.label}`} />;
  }

  return null;
}

export default function FormViewWidget(props: FormViewWidgetProps) {
  const [formValue, setFormValue] = useState(props.value);

  return (
    <Form
      initialValues={formValue}
      labelCol={{ span: 8 }}
      wrapperCol={{ span: 16 }}
      style={{ maxWidth: 720 }}
    >
      {props.fields.map(field => (
        <Form.Item
          key={field.name}
          label={field.label}
          name={field.name}
          rules={resolveFieldRules(field)}
        >
          {resolveFieldNode(field)}
        </Form.Item>
      ))}
      <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
        <Button type="primary">提交</Button>
      </Form.Item>
    </Form>
  );
}
