import { useState } from 'react';
import { Steps, Space, Button } from 'antd';

import ViewWrapper from '@/shared/components/control/view-wrapper';

import AppDirForm from './AppDirForm';
import AppConfigForm from './AppConfigForm';
import style from './style.scss';

export default function AppInitializerViewWidget() {
  const [current, setCurrent] = useState(0);
  const [dirFormValue, setDirFormValue] = useState({});
  const [configFormValue, setConfigFormValue] = useState({});

  const gotoNext = () => setCurrent(current + 1)
  const gotoPrev = () => setCurrent(current - 1)

  const handleAppDirFormSubmit = appDirFormValue => {
    setDirFormValue(appDirFormValue);
    gotoNext()
  }

  const handleAppConfigFormSubmit = appConfigFormValue => {
    setConfigFormValue(appConfigFormValue);
    gotoNext()
  }

  return (
    <ViewWrapper>
      <div className={style.AppInitializerViewWidget}>
        <div className={style['AppInitializerViewWidget-content']}>
          <Steps
            items={[{ title: '选择文件夹' }, { title: '填写信息' }, { title: '初始化' }]}
            current={current}
            labelPlacement="vertical"
          />
          <div className={style['AppInitializerViewWidget-body']}>
            {current === 0 && (
              <AppDirForm
                value={dirFormValue}
                onSubmit={handleAppDirFormSubmit}
              />
            )}
            {current === 1 && (
              <AppConfigForm
                value={configFormValue}
                onSubmit={handleAppConfigFormSubmit}
                onPrev={gotoPrev}
              />
            )}
            {current === 2 && (
              <div>
                <p>一切准备就绪，请开始初始化！</p>
                <Space>
                  <Button onClick={gotoPrev}>上一步</Button>
                  <Button type="primary">初始化</Button>
                </Space>
              </div>
            )}
          </div>
        </div>
      </div>
    </ViewWrapper>
  );
}
