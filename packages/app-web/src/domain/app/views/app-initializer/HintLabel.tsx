import type { ReactNode } from 'react';
import { Tooltip } from 'antd';
import { InfoCircleFilled } from '@ant-design/icons';

interface HintLabelProps {
  readonly label: string;
  readonly hint: ReactNode;
}

export default function HintLabel(props: HintLabelProps) {
  return (
    <>
      <span style={{ marginRight: 3 }}>{props.label}</span>
      <Tooltip title={props.hint}><InfoCircleFilled /></Tooltip>
    </>
  )
}
