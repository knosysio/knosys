import { Form, Input, Button } from 'antd';

const fields = [
  { label: '名称', name: 'name' },
  { label: '标题', name: 'title' },
  { label: 'LOGO', name: 'logo' },
  { label: '默认路径', name: 'path' },
];

function AppConfigViewWidget() {
  return (
    <Form labelCol={{ span: 8 }} wrapperCol={{ span: 16 }} style={{ maxWidth: 720 }}>
      {fields.map(field => (
        <Form.Item key={field.name} label={field.label} name={field.name}>
          <Input placeholder={`请输入${field.label}`} />
        </Form.Item>
      ))}
      <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
        <Button type="primary">提交</Button>
      </Form.Item>
    </Form>
  );
}

export default AppConfigViewWidget;
