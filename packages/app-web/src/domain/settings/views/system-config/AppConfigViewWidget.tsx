import { useState, useEffect } from 'react';
import { message } from 'antd';

import ViewWrapper from '@/shared/components/control/view-wrapper';
import FormViewWidget from '@/shared/components/widget/view/form-view';

import type { AppConfig } from '../../typing';
import { getAppConfig } from '../../repository';

const fields = [
  { label: '名称', name: 'name', required: true },
  { label: '标题', name: 'title', required: true },
  { label: '默认路径', name: 'path', required: true },
  { label: 'LOGO', name: 'logo' },
];

function AppConfigViewWidget() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (!config && !loading) {
      setLoading(true);
      getAppConfig()
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
        <FormViewWidget fields={fields} value={config} />
      ) : null}
    </ViewWrapper>
  );
}

export default AppConfigViewWidget;
