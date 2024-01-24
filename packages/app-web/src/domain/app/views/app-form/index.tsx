import { useState, useEffect } from 'react';
import { message } from 'antd';

import ViewWrapper from '@/shared/components/control/view-wrapper';
import FormViewWidget from '@/shared/components/widget/view/form-view';

import type { AppConfig } from '../../typing';
import { fields as modelFields } from '../../model';
import { getOne, updateOne } from '../../repository';

const fields = modelFields.map(field => ({
  ...field,
  disabled: ['name', 'path'].includes(field.name),
}));

function AppFormViewWidget() {
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

export default AppFormViewWidget;
