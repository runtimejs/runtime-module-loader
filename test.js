var test = require('tape');
var Loader = require('./');
var vm = require('vm');

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
