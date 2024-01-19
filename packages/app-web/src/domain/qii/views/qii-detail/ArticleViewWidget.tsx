import markdownIt from 'markdown-it';

import style from './style.scss';

const defaultBanner = require('@/shared/images/default-banner.jpg');

const md = markdownIt({ html: true });

function ArticleViewWidget({ dataSource: article }) {
  const rootClassNames = [style.ArticleViewWidget, style['has-banner']];

  return (
    <div className={rootClassNames.join(' ')}>
      <article className={style['ArticleViewWidget-main']}>
        <header className={style['ArticleViewWidget-header']} style={{ backgroundImage: `url("${defaultBanner}")` }}>
          <div className={style['ArticleViewWidget-headerInner']}>
            <h1 className={style['ArticleViewWidget-title']}>{ article.title }</h1>
          </div>
        </header>
        {article.content ? (
          <div className={style['ArticleViewWidget-body']} dangerouslySetInnerHTML={{ __html: md.render(article.content) }} />
        ) : null}
      </article>
    </div>
  )
}

export default ArticleViewWidget;
