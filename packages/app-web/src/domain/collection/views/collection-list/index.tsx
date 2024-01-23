import ViewWrapper from '@/shared/components/control/view-wrapper';

import CollectionListViewWidget from './CollectionListViewWidget';

import style from './style.scss';

function CollectionList() {
  return (
    <ViewWrapper>
      <div className={style.CollectionList}>
        <CollectionListViewWidget />
      </div>
    </ViewWrapper>
  );
}

export default CollectionList;
