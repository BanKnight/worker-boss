const path = require("path")
const buffer_op = require("buffer-op")
const awesome = require("awesome-async")
const child_process = require("child_process")
const vm = require("vm")
const fs = require("fs")
const EventEmitter = require("events")
const app = require("./head")
const config = app.config

const md_net = app.get("net")
const md_dispatcher = app.get("dispatcher")

const me = app.get("workers")
const data = me.data

me.init = async function ()
{
    data.loader_path = require.resolve("./loader")
    data.vm_loader_path = require.resolve("./vm_loader")
    data.vm_loader = fs.readFileSync(data.vm_loader_path, "utf8")
}
me.count = function ()
{
    return data.workers.size
}

/**
 * 新建一个worker
 * 1 新建只有ceo才有权限，因此，创建操作必须转发到ceo
 * 2 新建成功的标志是：新worker主动发起和ceo的连接，并且登录成功
 * 3 连通后，发起创建的worker才会返回成功
 * 4 创建成功后，被创建的worker会收到当前已有worker的列表，其他worker会收到新worker加入
 * 5 接收到新worker的通知后，通过id判断，判定是交由谁来进行主动连接
 * 
 * @param {*} file 
 * @param {*} args 
 */
me.new_worker = async function (file, ...args)
{
    //大boss
    let id = 0

    if (app.is_ceo() == true)
    {
        id = await me._real_new_worker(file, ...args)
    }
    else
    {
        id = await md_net.call_ceo("workers", "_real_new_worker", file, ...args)
        if (id)
        {
            me.new_worker_obj(id)
        }
        else
        {
            throw new Error(`new worker failed:${file}`)
        }
    }

    return id
}

me._real_new_worker = async function (file, ...args)
{
    if (data._quiting === true)
    {
        return false
    }

    let id = config.cluster << 13 | (++data.id_helper)

    let worker = me.new_worker_obj(id)

    let full_path = path.resolve(file)
    if (path.extname(full_path) == "")
    {
        full_path = full_path + ".js"
    }

    if (config.mode == "process")
    {
        await me._new_worker_process(worker, full_path, ...args)
    }
    else
    {
        await me._new_worker_vm(worker, full_path, ...args)
    }
    return id
}


me._new_worker_process = async function (worker, full_path, ...args)
{
    let new_env = Object.assign({}, process.env)

    new_env.worker_id = worker.id

    args.unshift(full_path)

    // console.log(`trying to new worker[${id}],file:${file}`)

    let child = child_process.fork(data.loader_path, args, {
        // detached: true,
        stdio: 'inherit',    //注意这三个的区别 : pipe,ignore,inherit
        env: new_env,        //环境变量 父子应该使用相同的环境变量
        // execArgv: process.env.execArgv,      //启动参数 这是只用于nodejs的命令行选项
    })

    child.on("exit", () =>
    {
        data.workers.delete(worker.id)

        console.log("worker exit:" + worker.id)

        awesome.wake("__exit")
    })

    // child_process.stdout.on('data', data.old_log);
    // child_process.stderr.on('data', data.old_err);

    await awesome.wait(`rlogin[${worker.id}]`)      //等待对端登陆成功
}

const natives = new Set(["fs", "path", "tty", "util",
    "stream", "assert", "events", "punycode", "tls",
    "url", "net", "querystring", "crypto", "buffer",
    "child_process", "cluster", "dns", "dgram", "constants",
    "https", "http", "os", "readline", "vm", "zlib", "module",
    "string_decoder",
])

const Module = module.constructor
const NativeModule = {
    is(name)
    {
        return natives.has(name)
    },
    require(name)
    {
        return require(name)
    },
    wrap(content)
    {
        return Module.wrap(content)
    }
}

me._new_worker_vm = async function (worker, full_path, ...args)
{
    let id = worker.id

    args.unshift(full_path)
    args.unshift(data.loader_path)

    let vm_global = {
        ___worker: id,
        Buffer: Buffer,
        setTimeout: setTimeout,
        setInterval: setInterval,
        clearTimeout: clearTimeout,
        setImmediate: setImmediate,
        old_console: old_console,
        console: Object.assign({}, old_console),
    }

    vm_global.global = vm_global

    const vm_context = vm.createContext(vm_global)

    const compiler = vm.runInContext(data.vm_loader, vm_context, {
        filename: data.vm_loader_path,
        lineOffset: 0,
        displayErrors: true
    })

    let vm_process = Object.assign(new EventEmitter(), process) //浅拷贝

    vm_process.env = Object.assign({}, process.env)
    vm_process.env.worker_id = id
    vm_process.argv = [process.argv[0], ...args]

    compiler(Module, NativeModule, vm_context, vm_process, ...args)

    await awesome.wait(`rlogin[${id}]`)      //等待对端登陆成功
}

me.get = function (id)
{
    return data.workers.get(id)
}

me.die = async function ()
{
    let result = false
    if (app.is_ceo() == true)
    {
        if (config.mode == "process")
        {
            result = await me._real_die()
        }
        else
        {
            process.exit(0)
        }
    }
    else
    {
        result = await md_net.call_ceo("workers", "_real_die")
    }

    return result
}

me._real_die = async function ()
{
    data._quiting = true

    for (let [_, worker] of data.workers)
    {
        md_net._send_worker(worker, "workers", "exit")
    }

    while (data.workers.size > 0)
    {
        await awesome.wait("__exit")
    }

    console.log("all worker exit,i'm about to quit")

    setImmediate(() =>
    {
        process.exit(0)
    })

    return true
}


me._login_remote = async function (worker)
{
    let standby = worker.standby

    worker.standby = null

    //console.log("begin to login remote:" + worker.id)

    let regist_workers = await md_net._call_worker(worker, "workers", "_login", app.self())

    for (let buffer of standby)
    {
        worker.conn.write(buffer)
    }

    //console.log("after login remote:" + worker.id)

    if (worker.id != config.cluster)
    {
        awesome.wake(`llogin[${worker.id}]`)
        return
    }

    // console.dir(regist_workers)

    await me._regist_workers(regist_workers)

    awesome.wake(`llogin[${worker.id}]`)
}

me._login = async function (conn, id)
{
    let worker = data.workers.get(id)
    if (worker == null)         //表明比注册快，并且是对端主动连接
    {
        worker = me.new_worker_obj(id)
    }

    conn.worker = worker
    worker.conn = conn

    for (let buffer of worker.standby)
    {
        conn.write(buffer)
    }

    worker.standby = null

    //console.log(`recv login from: ${id}`)

    conn.dispatch = md_net._after_login

    if (app.is_ceo() == false)
    {
        return
    }

    awesome.wake(`rlogin[${id}]`)       //远端登陆过来

    let regist_ids = [id]
    let ids = []

    for (let [exist_id, exist] of data.workers)
    {
        if (exist_id == config.cluster)
        {
            continue
        }
        if (exist.conn == null)
        {
            continue
        }
        if (exist == worker)
        {
            continue
        }
        //已经成功登录的 才能发送

        md_net._send_worker(exist, "workers", "_regist_workers", regist_ids)

        ids.push(exist_id)
    }

    return ids
}

me._on_invoke = function (worker, ...args)
{
    try
    {
        md_dispatcher.dispatch(...args)
    }
    catch (e)
    {
        console.error(e.stack)
    }
}
me._on_call = async function (worker, session, ...args)
{
    try
    {
        let ret = await md_dispatcher.dispatch(...args)

        md_net._ret_worker(worker, session, null, ret)
    }
    catch (e)
    {
        md_net._ret_worker(worker, session, e)
    }
}

me._on_resp = function (worker, session, err, ret)
{
    // console.log(`resp from worker[${worker.id}]: ${ret}`)

    awesome.wake(`__c${session}`, [err, ret])
}

me._on_error = function (worker, session, err)
{
    awesome.wake(`__c${session}`, [err])
}

me._on_inside_invoke = function (worker, md_name, func_name, ...args)
{
    // console.log(`invoke from [${worker.id}]:${func_name}(${args})`)

    let md = app.get(md_name)

    md[func_name](...args)

}
me._on_inside_call = async function (worker, session, md_name, func_name, ...args)
{
    //console.log(`call from [${worker.id}]: ${args}`)

    let md = app.get(md_name)

    let ret = await md[func_name](...args)

    md_net._ret_worker(worker, session, null, ret)
}

me.new_worker_obj = function (id)
{
    let worker = { id: id, standby: [], retry: 0 }

    worker.out_stream = new buffer_op.Stream()
    worker.out_writer = new buffer_op.Writer(worker.out_stream)

    data.workers.set(id, worker)

    return worker
}

me._regist_workers = async function (ids)
{
    for (let id of ids)
    {
        if (id == config.cluster)
        {
            continue
        }
        if (id >= app.self())       //对方比我们大，等待对方链接
        {
            continue
        }
        let worker = data.workers.get(id)
        if (worker)
        {
            continue
        }
        worker = me.new_worker_obj(id)

        //Todo 这里不用await，需要仔细思考一下是否ok
        md_net._connect_worker(worker)
    }
}

me.exit = function ()
{
    //console.log("recv exit cmd")

    if (app.is_ceo() == true)
    {
        me.die()
    }
    else
    {
        process.exit(0)
    }
}

