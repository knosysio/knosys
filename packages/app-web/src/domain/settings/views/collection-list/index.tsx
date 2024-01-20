import CollectionListViewWidget from './CollectionListViewWidget';

import style from './style.scss';

function CollectionList() {
  return (
    <div className={style.CollectionList}>
      <CollectionListViewWidget />
    </div>
  );
}

export default CollectionList;
