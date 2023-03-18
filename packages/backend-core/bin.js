const { existsSync } = require('fs');
const { isString, isPlainObject, readData } = require('./utils');

function getConfig(cwd) {
  const configFilePath = `${cwd}/.knosysrc`;

  let config = {};

  if (existsSync(configFilePath)) {
    try {
      config = JSON.parse(readData(configFilePath));
    } catch(err) {}
  }

  return config;
}

function execute() {
  const cwd = process.env.INIT_CWD; // will be `undefined` when not called by npm scripts
  const [command, ...params] = process.argv.slice(2);
  const commandConfig = getConfig(cwd).command;

  let scriptFile;

  if (isString(commandConfig)) {
    scriptFile = `${commandConfig}/${command}.js`;
  } else if (isPlainObject(commandConfig) && isString(commandConfig[command])) {
    scriptFile = `${commandConfig[command].replace('.js', '')}.js`;
  }

  try {
    require(`${cwd}/${scriptFile}`).execute(...params);
  } catch (err) {
    console.log('[ERROR]', err);
  }
}

module.exports = { execute };
