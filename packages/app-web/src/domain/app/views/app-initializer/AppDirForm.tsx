import { Form, Input, Button } from 'antd';

import HintLabel from './HintLabel';

interface AppDirFormProps {
  readonly value?: Record<string, any>;
  readonly onSubmit?: (value: Record<string, any>) => any;
}

export default function AppDirForm(props: AppDirFormProps) {
  let changedValue = {};

  return (
    <Form
      initialValues={props.value}
      labelCol={{ span: 4 }}
      wrapperCol={{ span: 20 }}
      onValuesChange={changed => (changedValue = changed)}
      onFinish={props.onSubmit}
    >
      <Form.Item
        label={<HintLabel label="根文件夹" hint="macOS 可打开终端，将目标文件夹拖进去后把完整路径复制出来" />}
        name="root"
        rules={[{ required: true, message: '请输入根文件夹绝对路径' }]}
      >
        <Input.TextArea
          placeholder="数据源所在本地 Git 仓库的绝对路径"
          autoSize={{ minRows: 1, maxRows: 2 }}
          style={{ resize: 'none' }}
        />
      </Form.Item>
      <Form.Item
        label="数据源"
        name="source"
      >
        <Input placeholder="在根文件夹内的相对路径，默认为 ./data" />
      </Form.Item>
      <Form.Item wrapperCol={{ offset: 4, span: 20 }}>
        <Button type="primary" htmlType="submit">下一步</Button>
      </Form.Item>
    </Form>
  );
}
