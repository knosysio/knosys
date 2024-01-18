/**
 * QiiDB related
 *
 * @see https://qiidb.github.io/meta/zh/guides/spec/
 */

// Files
const LEGACY_ENTITY_NAME = 'metadata.yml';
const ENTITY_MONO_NAME = 'entity.yml';
const ENTITY_MAIN_NAME = 'basic.yml';
const ENTITY_CONTENT_NAME = 'readme.md';

// Directories
const META_DIR_NAME = '.meta';

// Others
const DEFAULT_PATH_SCHEMA = ':category/:collection/:slug';

module.exports = {
  LEGACY_ENTITY_NAME, ENTITY_MONO_NAME, ENTITY_MAIN_NAME, ENTITY_CONTENT_NAME,
  META_DIR_NAME,
  DEFAULT_PATH_SCHEMA,
};

