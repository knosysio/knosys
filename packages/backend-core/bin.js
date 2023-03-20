const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');

const { isString, isPlainObject, resolveRootPath, getConfig } = require('./utils');

function execute() {
  const [command, ...params] = process.argv.slice(2);
  const commandFileName = `${command}.js`;
  const commandConfig = getConfig('command');

  let scriptFile;

  if (isString(commandConfig)) {
    scriptFile = `${commandConfig}/${commandFileName}`;
  } else if (isPlainObject(commandConfig) && isString(commandConfig[command])) {
    scriptFile = `${commandConfig[command].replace('.js', '')}.js`;
  }

  try {
    const defaultCommandPath = resolvePath(__dirname, `./commands/${commandFileName}`);

    let scriptFilePath = resolvePath(resolveRootPath(), scriptFile);

    if (!existsSync(scriptFilePath) && existsSync(defaultCommandPath)) {
      scriptFilePath = defaultCommandPath;
    }

    require(scriptFilePath).execute(...params);
  } catch (err) {
    console.log('[ERROR]', err);
  }
}

module.exports = { execute };
