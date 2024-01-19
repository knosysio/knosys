import { useState, useDeferredValue } from 'react';
import { Input } from 'antd';

import ArticleEditor from './ArticleEditor';
import ArticlePreviewer from './ArticlePreviewer';
import style from './style.scss';

function EditorViewWidget({ dataSource }) {
  const [content, setContent] = useState(dataSource.content);
  const deferredContent = useDeferredValue(content);

  return (
    <div className={style.EditorViewWidget}>
      <div className={style['EditorViewWidget-title']}>
        <Input defaultValue={dataSource.title} placeholder="起个震惊四座的标题吧！😜" />
      </div>
      <div className={style['EditorViewWidget-content']}>
        <div className={style['EditorViewWidget-editor']}>
          <ArticleEditor content={content} onUpdate={(newContent: string) => setContent(newContent)} />
        </div>
        <div className={style['EditorViewWidget-previewer']}>
          <ArticlePreviewer content={deferredContent} />
        </div>
      </div>
    </div>
  );
}

export default EditorViewWidget;
