import classnames from 'classnames';
import { Spin } from 'antd';

import type { ViewWrapperControlProps } from './typing';
import style from './style.scss';

export default function ViewWrapper(props: ViewWrapperControlProps) {
  return (
    <div className={classnames(style.ViewWrapper, props.className)}>
      <Spin size="large" spinning={props.loading || false}>
        {props.children}
      </Spin>
    </div>
  );
}
