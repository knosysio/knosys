import { Tabs } from 'antd';

import AppFormViewWidget from '../../../app/views/app-form';
import style from './style.scss';

const items = [
  { key: 'app', label: '应用', children: <AppFormViewWidget /> },
];

export default function ConfigSettings() {
  return (
    <div className={style.ConfigSettings}>
      <Tabs defaultActiveKey={items[0].key} items={items} tabPosition="left" />
    </div>
  );
}
