import markdownIt from 'markdown-it';

import style from './style.scss';

const md = markdownIt({ html: true });

function ArticlePreviewer({ content }) {
  return (
    <article
      className={style.ArticlePreviewer}
      dangerouslySetInnerHTML={{ __html: md.render(content || '请输入内容') }}
    />
  );
}

export default ArticlePreviewer;
