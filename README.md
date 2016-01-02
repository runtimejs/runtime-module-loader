## runtime-module-loader

Node.js compatible module loader for runtime.js

[![Build Status](https://travis-ci.org/runtimejs/runtime-module-loader.svg)](https://travis-ci.org/runtimejs/runtime-module-loader)

## USAGE

```js
var Loader = require('runtime-module-loader');
var loader = new Loader(fileExistsFunction, readFileFunction, runScriptFunction);
loader.require('./index');
```

##LICENSE

Apache License, Version 2.0
