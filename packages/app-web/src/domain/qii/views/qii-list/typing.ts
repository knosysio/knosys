import type { PaginationProps } from 'antd';

type ListViewWidgetProps = {
  dataSource?: Record<string, any>[];
  pagination?: PaginationProps;
  onDelete?: (record: Record<string, any>) => void;
};

export type { ListViewWidgetProps };
