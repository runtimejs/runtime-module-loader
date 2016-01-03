## runtime-module-loader

Node.js compatible module loader for runtime.js

[![Build Status](https://travis-ci.org/runtimejs/runtime-module-loader.svg)](https://travis-ci.org/runtimejs/runtime-module-loader)

Features:
- Node.js module resolution algorithm
- package.json `runtime` field to be able to override entry point for runtime.js, similar to browser field
- runtime.js can't handle native `*.node` modules, throws an error for those

## USAGE

```js
var Loader = require('runtime-module-loader');
var loader = new Loader(fileExistsFunction, readFileFunction, runScriptFunction);
loader.require('./index');
```

##LICENSE

Apache License, Version 2.0
