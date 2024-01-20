import { Tabs } from 'antd';

import AppConfigViewWidget from './AppConfigViewWidget';
import style from './style.scss';

const items = [
  { key: 'app', label: '应用', children: <AppConfigViewWidget /> },
];

export default function ConfigSettings() {
  return (
    <div className={style.ConfigSettings}>
      <Tabs defaultActiveKey={items[0].key} items={items} tabPosition="left" />
    </div>
  );
}
