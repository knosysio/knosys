#!/usr/bin/env node
require('../helper').execute().catch(error => { console.error(error.message); process.exitCode = 1; });
