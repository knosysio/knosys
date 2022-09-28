const { existsSync } = require('fs');
const { readData } = require('./fs');

function getConfig(cwd) {
  const configFilePath = `${cwd}/.fsdmrc`;

  let config = {};

  if (existsSync(configFilePath)) {
    try {
      config = JSON.parse(readData(configFilePath));
    } catch(err) {}
  }

  return config;
}

function execute() {
  const cwd = process.env.INIT_CWD;
  const [command, ...params] = process.argv.slice(2);
  const commandConfig = getConfig(cwd).command;

  let scriptFile;

  if (typeof commandConfig === 'string') {
    scriptFile = `${commandConfig}/${command}.js`;
  } else if (typeof commandConfig === 'object' && typeof commandConfig[command] === 'string') {
    scriptFile = `${commandConfig[command].replace('.js', '')}.js`;
  }

  try {
    require(`${cwd}/${scriptFile}`).execute(...params);
  } catch (err) {}
}

module.exports = { execute };
