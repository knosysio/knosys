import { useState, useEffect } from 'react';
import { message } from 'antd';

import ViewWrapper from '@/shared/components/control/view-wrapper';
import FormViewWidget from '@/shared/components/widget/view/form-view';

import type { AppConfig } from '../../typing';
import { getOne, updateOne } from '../../repository';

const fields = [
  { label: '名称', name: 'name', required: true, disabled: true },
  { label: '标题', name: 'title', required: true },
  { label: '默认路径', name: 'path', required: true, disabled: true },
  { label: 'LOGO', name: 'logo' },
];

function AppConfigViewWidget() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const handleSubmit = value => {
    setLoading(true);
    updateOne(value)
      .then(res => {
        if (res.success) {
          message.success('更新成功');
        } else {
          message.error(res.message);
        }
      })
      .finally(() => setLoading(false))
  };

  useEffect(() => {
    if (!config && !loading) {
      setLoading(true);
      getOne()
        .then(res => {
          if (res.success) {
            setConfig(res.data);
          } else {
            message.error(res.message);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [config]);

  return (
    <ViewWrapper loading={loading}>
      {config ? (
        <FormViewWidget fields={fields} value={config} onSubmit={handleSubmit} />
      ) : null}
    </ViewWrapper>
  );
}

export default AppConfigViewWidget;
