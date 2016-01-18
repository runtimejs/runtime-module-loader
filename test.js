var test = require('tape');
var Loader = require('./');
var vm = require('vm');
var escapeStringRegexp = require('escape-string-regexp');

function rgx(message) {
  return new RegExp(escapeStringRegexp(message));
}

function evalScript(content, filename) {
  return vm.runInThisContext(content, filename);
}

function defineModules(modules) {
  var count = 0;
  return {
    exists: function(path) { return !!modules[path]; },
    read: function(path) { ++count; return modules[path] || null; },
    readCount: function() { return count; }
  };
}

test('basic', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/module1.js': "++count; module.exports = 10",
    '/module2.js': "++count; exports.foo = 3; exports.bar = 6 + require('./module3');",
    '/module3.js': "++count; module.exports = 1;",
    '/main.js': "++count; module.exports = require('./module1') + require('./module2').foo + require('./module2').bar"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 20);
  t.equal(modules.readCount(), 4);
  t.equal(global.count, 4);
  t.end();
});

test('circular', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/first.js': "++count; var second = require('./second'); exports.foo = function() { return second.bar; }; exports.bar = 3;",
    '/second.js': "++count; var first = require('./first'); exports.foo = function() { return first.bar; }; exports.bar = 4;",
    '/main.js': "++count; module.exports = require('./second').foo() + require('./first').foo()"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 7);
  t.equal(modules.readCount(), 3);
  t.equal(global.count, 3);
  t.end();
});

test('full path require', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/module.js': "++count; exports.foo = 10;",
    '/main.js': "++count; module.exports = require('/module').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 10);
  t.equal(modules.readCount(), 2);
  t.equal(global.count, 2);
  t.end();
});

test('full name require', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/module.js': "++count; exports.foo = 10;",
    '/main.js': "++count; module.exports = require('/module.js').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 10);
  t.equal(modules.readCount(), 2);
  t.equal(global.count, 2);
  t.end();
});

test('json require', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/file.json': '{"a":10}',
    '/main.js': "++count; module.exports = require('/file.json').a;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 10);
  t.equal(modules.readCount(), 2);
  t.equal(global.count, 1);
  t.end();
});

test('handle . and ..', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/dir/module.js': "++count; module.exports = require('../a') + 8;",
    '/a.js': "++count; module.exports = 2;",
    '/main.js': [
      "++count;",
      "module.exports = ",
      "require('/dir/module.js') +",
      "require('/dir/module') +",
      "require('/dir/./././module') +",
      "require('/dir/a/b/c/../../../module') +",
      "require('/dir/a/b/c/../../../module.js') +",
      "require('/dir/a/b/c/../../../../a.js') +",
      "require('/dir/a/b/c/../../../../a') +",
      "0"
    ].join('\n')
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 54);
  t.equal(modules.readCount(), 3);
  t.equal(global.count, 3);
  t.end();
});

test('handle invalid ..', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/dir/module.js': "++count; module.exports = require('../../../../../../a') + 8;",
    '/main.js': "++count; module.exports = require('/dir/module.js')"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.throws(function() {
    loader.require('/main');
  }, rgx("Cannot resolve module '../../../../../../a' from '/dir/module.js'"));
  t.equal(modules.readCount(), 2);
  t.equal(global.count, 2);
  t.end();
});

test('handle invalid .. using node_modules', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/dir/module.js': "++count; module.exports = require('module/a/../../../../../a') + 8;",
    '/main.js': "++count; module.exports = require('/dir/module.js')"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.throws(function() {
    loader.require('/main');
  }, rgx("Cannot resolve module 'module/a/../../../../../a' from '/dir/module.js'"));
  t.equal(modules.readCount(), 2);
  t.equal(global.count, 2);
  t.end();
});

test('require directory', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/dir/index.js': "++count; exports.foo = 10;",
    '/main.js': "++count; module.exports = require('./dir').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 10);
  t.equal(modules.readCount(), 2);
  t.equal(global.count, 2);
  t.end();
});

test('package.json main field', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/dir/abc.js': "++count; exports.foo = 1;",
    '/dir/package.json': '{"main":"abc.js"}',
    '/dir2/abc.js': "++count; exports.foo = 2;",
    '/dir2/package.json': '{"main":"./abc.js"}',
    '/main.js': "++count; module.exports = require('./dir').foo + require('./dir2').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 3);
  t.equal(modules.readCount(), 5);
  t.equal(global.count, 3);
  t.end();
});

test('package.json runtime field', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/dir/abc.js': "++count; exports.foo = 1;",
    '/dir/abc-runtime.js': "++count; exports.foo = 15;",
    '/dir/package.json': '{"main":"abc.js","runtime":"./abc-runtime"}',
    '/main.js': "++count; module.exports = require('./dir').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 15);
  t.equal(modules.readCount(), 3);
  t.equal(global.count, 2);
  t.end();
});

test('package.json runtime invalid value', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/dir/abc.js': "++count; exports.foo = 1;",
    '/dir/abc-runtime.js': "++count; exports.foo = 15;",
    '/dir/package.json': '{"main":"abc.js","runtime":{"a":"bc"}}',
    '/main.js': "++count; module.exports = require('./dir').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.throws(function() {
    loader.require('/main');
  }, rgx("package.json '/dir/package.json' runtime field value is invalid"));
  t.equal(modules.readCount(), 2);
  t.equal(global.count, 1);
  t.end();
});

test('package.json parse error', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/dir/package.json': '{"main"}',
    '/main.js': "++count; module.exports = require('./dir').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.throws(function() {
    loader.require('/main');
  }, rgx("package.json '/dir/package.json' parse error"));
  t.equal(modules.readCount(), 2);
  t.equal(global.count, 1);
  t.end();
});

test('require from node_modules', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/a.js': "++count; exports.foo = 1;",
    '/node_modules/b.js': "++count; exports.foo = 4;",
    '/main.js': "++count; module.exports = require('a').foo + require('b').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 5);
  t.equal(modules.readCount(), 3);
  t.equal(global.count, 3);
  t.end();
});

test('builtin module', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/a.js': "++count; exports.foo = 1;",
    '/node_modules/b.js': "++count; exports.foo = 4;",
    '/node_modules/builtin-a.js': "++count; exports.foo = 10;",
    '/main.js': "++count; module.exports = require('a').foo + require('b').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript, {
    'a': '/node_modules/builtin-a.js'
  });
  t.equal(loader.require('/main'), 14);
  t.equal(modules.readCount(), 3);
  t.equal(global.count, 3);
  t.end();
});

test('builtin module resolve from subdir', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/a.js': "++count; exports.foo = 1;",
    '/node_modules/b.js': "++count; exports.foo = 4;",
    '/subdir/builtin-a.js': "++count; exports.foo = 10;",
    '/main.js': "++count; module.exports = require('a').foo + require('b').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript, {
    'a': './builtin-a.js'
  }, '/subdir');
  t.equal(loader.require('/main'), 14);
  t.equal(modules.readCount(), 3);
  t.equal(global.count, 3);
  t.end();
});

test('builtin module resolve from subdir in node_modules', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/a.js': "++count; exports.foo = 1;",
    '/node_modules/b.js': "++count; exports.foo = 4;",
    '/subdir/node_modules/builtin-a.js': "++count; exports.foo = 10;",
    '/main.js': "++count; module.exports = require('a').foo + require('b').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript, {
    'a': 'builtin-a'
  }, '/subdir');
  t.equal(loader.require('/main'), 14);
  t.equal(modules.readCount(), 3);
  t.equal(global.count, 3);
  t.end();
});

test('require from node_modules specific path', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/a/hello.js': "++count; exports.foo = 1;",
    '/node_modules/b.js': "++count; exports.foo = 4;",
    '/main.js': "++count; module.exports = require('a/hello').foo + require('b').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 5);
  t.equal(modules.readCount(), 3);
  t.equal(global.count, 3);
  t.end();
});

test('require from node_modules nested', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/a.js': "++count; exports.foo = 1;",
    '/node_modules/b.js': "++count; exports.foo = 4;",
    '/node_modules/module/node_modules/a.js': "++count; exports.foo = 11;",
    '/node_modules/module/node_modules/b.js': "++count; exports.foo = 41;",
    '/node_modules/module/index.js': "++count; module.exports = require('a').foo + require('b').foo;",
    '/main.js': "++count; module.exports = require('a').foo + require('b').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 5);
  t.equal(loader.require('module'), 52);
  t.equal(modules.readCount(), 6);
  t.equal(global.count, 6);
  t.end();
});

test('require from node_modules nested directory', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/a/index.js': "++count; exports.foo = 1;",
    '/node_modules/b/index.js': "++count; exports.foo = 4;",
    '/node_modules/module/node_modules/a/index.js': "++count; exports.foo = 11;",
    '/node_modules/module/node_modules/b/index.js': "++count; exports.foo = 41;",
    '/node_modules/module/index.js': "++count; module.exports = require('a').foo + require('b').foo;",
    '/main.js': "++count; module.exports = require('a').foo + require('b').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 5);
  t.equal(loader.require('module'), 52);
  t.equal(modules.readCount(), 6);
  t.equal(global.count, 6);
  t.end();
});

test('require from node_modules nested search', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/a.js': "++count; exports.foo = 1;",
    '/node_modules/b.js': "++count; exports.foo = 4;",
    '/node_modules/module/index.js': "++count; module.exports = require('a').foo + require('b').foo;",
    '/main.js': "++count; module.exports = require('a').foo + require('b').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.equal(loader.require('/main'), 5);
  t.equal(loader.require('module'), 5);
  t.equal(modules.readCount(), 4);
  t.equal(global.count, 4);
  t.end();
});

test('should not load from dependency from nested node_modules', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/dep/node_modules/a.js': "++count; exports.foo = 1;",
    '/node_modules/dep/node_modules/b.js': "++count; exports.foo = 4;",
    '/main.js': "++count; module.exports = require('a').foo + require('b').foo;"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.throws(function () {
    loader.require('/main');
  }, rgx("Cannot resolve module 'a' from '/main.js'"));
  t.equal(modules.readCount(), 1);
  t.equal(global.count, 1);
  t.end();
});

test('native module error', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/module.node': "<binary>",
    '/main.js': "++count; module.exports = require('module')"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.throws(function () {
    loader.require('/main');
  }, rgx("Native Node.js modules are not supported '/node_modules/module.node'"));
  t.equal(modules.readCount(), 1);
  t.equal(global.count, 1);
  t.end();
});

test('module syntax error', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/a.js': "\nvar z = { hello world };",
    '/main.js': "++count; module.exports = require('a')"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.throws(function () {
    loader.require('/main');
  }, rgx("Unexpected identifier"));
  t.equal(modules.readCount(), 2);
  t.equal(global.count, 1);
  t.end();
});

test('module throws', function(t) {
  global.count = 0;
  var modules = defineModules({
    '/node_modules/a.js': "\nthrow new Error('custom error');",
    '/main.js': "++count; module.exports = require('a')"
  });
  var loader = new Loader(modules.exists, modules.read, evalScript);
  t.throws(function () {
    loader.require('/main');
  }, rgx("custom error"));
  t.equal(modules.readCount(), 2);
  t.equal(global.count, 1);
  t.end();
});
