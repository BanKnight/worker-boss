
(function (OriModule, NativeModule, vm_context, this_process)
{
    global.process = this_process

    const filename = this_process.argv[1]

    const fs = NativeModule.require("fs")
    const path = NativeModule.require("path")
    const vm = NativeModule.require("vm")
    const assert = NativeModule.require('assert').ok;

    let make_require
    let tryModuleLoad

    class Module
    {
        constructor(id, parent)
        {
            this.id = id;
            this.exports = {};
            this.parent = parent;
            this.filename = null;
            this.loaded = false;
        }

        load(filename)
        {
            this.filename = filename
            this.paths = OriModule._nodeModulePaths(path.dirname(filename));

            let extension = path.extname(filename) || '.js';
            if (!Module._extensions[extension]) extension = '.js';
            Module._extensions[extension](this, filename);
            this.loaded = true;
        }
        _compile(content, filename)
        {
            const dirname = path.dirname(filename);

            const wrapper = NativeModule.wrap(content)

            const compiledWrapper = vm.runInContext(wrapper, vm_context, {
                filename: filename,
                lineOffset: 0,
                displayErrors: true
            });

            // const compiledWrapper = new Function("exports", "require", "module", "__filename", "__dirname", content)

            const require = make_require(this);

            let result = compiledWrapper.call(this.exports, this.exports, require, this,
                filename, dirname);

            return result;
        }

        require(path)
        {
            assert(path, 'missing path');
            assert(typeof path === 'string', 'path must be a string');

            return Module._load(path, this, /* isMain */ false);
        }

        static _load(request, parent, isMain)
        {
            var filename = OriModule._resolveFilename(request, parent, isMain);
            var cachedModule = Module._cache[filename];
            if (cachedModule)
            {
                return cachedModule.exports
            }
            if (NativeModule.is(filename))
            {
                return NativeModule.require(filename)
            }

            const module = new Module(filename, parent);

            Module._cache[filename] = module;

            tryModuleLoad(module, filename);

            return module.exports;
        }
    }

    Module._cache = {}
    Module._extensions = {}

    Module._extensions['.js'] = function (module, filename)
    {
        var content = fs.readFileSync(filename, 'utf8');
        module._compile(content, filename);
    };

    Module._extensions['.json'] = function (module, filename)
    {
        var content = fs.readFileSync(filename, 'utf8');
        try
        {
            module.exports = JSON.parse(content);
        }
        catch (err)
        {
            err.message = filename + ': ' + err.message;
            throw err;
        }
    };

    //Native extension for .node
    Module._extensions['.node'] = function (module, filename)
    {
        return process.dlopen(module, path._makeLong(filename));
    };

    tryModuleLoad = function (module, filename)
    {
        var threw = true;
        try
        {
            module.load(filename);
            threw = false;
        }
        catch (err)
        {
            console.error(err.stack)
        }
        finally
        {
            if (threw)
            {
                delete Module._cache[filename];
            }
        }
    }

    make_require = function (mod)
    {
        function require(path)
        {
            try
            {
                return mod.require(path)
            }
            finally
            {
            }
        }

        function resolve(request, options)
        {
            return OriModule._resolveFilename(request, mod, false, options);
        }

        function paths(request)
        {
            return OriModule._resolveLookupPaths(request, mod, true);
        }

        require.resolve = resolve

        resolve.paths = paths;

        // require.main = process.mainModule;

        // Enable support to add extra extension types.
        require.extensions = Module._extensions;

        require.cache = Module._cache;

        return require;
    }

    // const fakeParent = new Module("")

    // fakeParent.paths = Module._nodeModulePaths(path.dirname(filename));

    // let require = make_require(fakeParent)

    // require(filename)

    var module = new Module(filename, null);

    module.id = '.';

    Module._cache[filename] = module;

    tryModuleLoad(module, filename);
})
