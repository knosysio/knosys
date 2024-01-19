import { Input } from 'antd';

import style from './style.scss';

const { TextArea } = Input;

function ArticleEditor({ content, onUpdate }) {
  return (
    <TextArea
      className={style.ArticleEditor}
      value={content}
      placeholder="请开始你的创作😄"
      onChange={e => onUpdate && onUpdate(e.target.value)}
    />
  )
}

export default ArticleEditor;
