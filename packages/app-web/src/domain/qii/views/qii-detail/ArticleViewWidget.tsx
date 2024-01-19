import dayjs from 'dayjs';
import markdownIt from 'markdown-it';
import { Tag } from 'antd';
import { ClockCircleFilled } from '@ant-design/icons';

import { resolveBannerUrl } from '../../helper';

import style from './style.scss';

const md = markdownIt({ html: true });

function ArticleViewWidget({ dataSource: article }) {
  const rootClassNames = [style.ArticleViewWidget];

  let banner = article.banner || article.cover;

  if (banner) {
    banner = resolveBannerUrl(banner);

    rootClassNames.push(style['has-banner']);
  }

  const publishedAt = dayjs(article.date).format('YYYY-MM-DD HH:mm:ss');

  return (
    <div className={rootClassNames.join(' ')}>
      {banner ? (
        <div className={style['ArticleViewWidget-banner']} style={{ backgroundImage: `url("${banner}")` }}>
          <img src={banner} />
        </div>
      ) : null}
      <article className={style['ArticleViewWidget-main']}>
        <header className={style['ArticleViewWidget-header']}>
          <h1 className={style['ArticleViewWidget-title']}>{article.title}</h1>
          <div className={style['ArticleViewWidget-meta']}>
            <div className={style['ArticleViewWidget-publishTime']}>
              <ClockCircleFilled />
              <time dateTime={article.date}>{publishedAt}</time>
            </div>
            {article.tags && article.tags.length > 0 ? (
              <div className={style['ArticleViewWidget-tags']}>{article.tags.map((tag: string) => <Tag key={tag}>{tag}</Tag>)}</div>
            ) : null}
          </div>
        </header>
        {article.content ? (
          <div className={style['ArticleViewWidget-body']} dangerouslySetInnerHTML={{ __html: md.render(article.content) }} />
        ) : null}
      </article>
    </div>
  );
}

export default ArticleViewWidget;
