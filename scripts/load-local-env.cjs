const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

const dotenv = require('dotenv');

const DEFAULT_ENV_FILES = ['.env.local', '.env.production.local', '.env.production', '.env'];

function loadLocalEnv({ cwd = process.cwd(), files = DEFAULT_ENV_FILES } = {}) {
  const loaded = [];

  for (const file of files) {
    const envPath = resolve(cwd, file);

    if (!existsSync(envPath)) {
      continue;
    }

    const result = dotenv.config({ path: envPath, override: false, quiet: true });

    if (result.error) {
      throw new Error(`Failed to load ${file}: ${result.error.message}`);
    }

    loaded.push(file);
  }

  return loaded;
}

module.exports = {
  DEFAULT_ENV_FILES,
  loadLocalEnv,
};

