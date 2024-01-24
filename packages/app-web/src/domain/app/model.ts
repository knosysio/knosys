import type { FieldDescriptor } from '@/shared/types';

const fields: FieldDescriptor[] = [
  {
    label: '名称',
    name: 'name',
    required: true,
    placeholder: '只允许输入小写英文字母、数字和连字符「-」与下划线「_」',
  },
  {
    label: '标题',
    name: 'title',
    required: true,
  },
  {
    label: '默认路径',
    name: 'path',
    required: true,
    placeholder: '默认为 :category/:collection/:slug',
    hint: ':category 部分可省略，:collection 不可缺少，之后的部分为记录的路径模式，详见：https://knosysio.github.io/apis/meta/',
  },
  { label: 'LOGO', name: 'logo' },
];

export { fields };
