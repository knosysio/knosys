import type { FormRule } from 'antd/es';
import { Form, Input, Space, Button, message } from 'antd';

import type { FieldDescriptor } from '@/shared/types';

import { fields } from '../../model';

import HintLabel from './HintLabel';

interface AppConfigFormProps {
  readonly value?: Record<string, any>;
  readonly onSubmit?: (value: Record<string, any>) => any;
  readonly onPrev?: () => any;
}

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
    return <Input placeholder={field.placeholder || `请输入${field.label}`} disabled={field.disabled || false} />;
  }

  return null;
}

export default function AppConfigForm(props: AppConfigFormProps) {
  let changedValue = {};

  return (
    <Form
      initialValues={props.value}
      labelCol={{ span: 4 }}
      wrapperCol={{ span: 20 }}
      onValuesChange={changed => (changedValue = changed)}
      onFinish={props.onSubmit}
    >
      {fields.map(field => (
        <Form.Item
          key={field.name}
          label={field.hint ? <HintLabel label={field.label} hint={field.hint} /> : field.label}
          name={field.name}
          rules={resolveFieldRules(field)}
        >
          {resolveFieldNode(field)}
        </Form.Item>
      ))}
      <Form.Item wrapperCol={{ offset: 4, span: 20 }}>
        <Space>
          <Button onClick={props.onPrev}>上一步</Button>
          <Button type="primary" htmlType="submit">下一步</Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
