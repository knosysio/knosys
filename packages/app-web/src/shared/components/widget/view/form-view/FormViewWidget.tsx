import { Form, Input, Button, message } from 'antd';
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
    return <Input placeholder={`请输入${field.label}`} disabled={field.disabled || false} />;
  }

  return null;
}

export default function FormViewWidget(props: FormViewWidgetProps) {
  let changedValue = {};

  const handleClick = evt => {
    if (Object.keys(changedValue || {}).length > 0) {
      props.onSubmit && props.onSubmit(changedValue);
    } else {
      message.warning('表单值没有任何改变');
    }

    evt.preventDefault();
    evt.stopPropagation();
  };

  return (
    <Form
      initialValues={props.value}
      labelCol={{ span: 8 }}
      wrapperCol={{ span: 16 }}
      style={{ maxWidth: 720 }}
      onValuesChange={changed => (changedValue = changed)}
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
        <Button type="primary" onClick={handleClick}>提交</Button>
      </Form.Item>
    </Form>
  );
}
