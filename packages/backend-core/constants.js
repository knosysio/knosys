const GLOBAL_DIR_NAME = '.knosys';
const CONFIG_FILE_NAME = '.knosysrc';

/**
 * @see https://qiidb.github.io/zh/meta/guides/spec/
 */
const LEGACY_ENTITY_NAME = 'metadata.yml';
const ENTITY_MONO_NAME = 'entity.yml';
const ENTITY_MAIN_NAME = 'basic.yml';
const ENTITY_CONTENT_NAME = 'readme.md';
const META_DIR_NAME = '.meta';
const DEFAULT_PATH_SCHEMA = ':category/:collection/:slug';

const DEFAULT_SITE_NAME = 'default';
const DEFAULT_SSG_TYPE = 'jekyll';

module.exports = {
  GLOBAL_DIR_NAME, CONFIG_FILE_NAME,
  LEGACY_ENTITY_NAME, ENTITY_MONO_NAME, ENTITY_MAIN_NAME, ENTITY_CONTENT_NAME, META_DIR_NAME, DEFAULT_PATH_SCHEMA,
  DEFAULT_SITE_NAME, DEFAULT_SSG_TYPE,
};
