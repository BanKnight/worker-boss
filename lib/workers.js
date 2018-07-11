const path = require("path")
const buffer_op = require("buffer-op")
const awesome = require("awesome-async")
const child_process = require("child_process")

let boss = require("./head")
let data = boss.data

boss._init_workers = async function ()
{
    data.loader_path = require.resolve("./loader")
}

boss.on_invoke = function (cb)
{
    data.invoke = cb
}
boss.on_call = function (cb)
{
    data.call = cb
}

/**
 * 新建一个worker
 * 1 新建只有ceo才有权限，因此，创建操作必须转发到ceo
 * 2 新建成功的标志是：新worker主动发起连接和ceo的连接，并且登录成功
 * 3 连通后，发起创建的worker才会返回成功
 * 4 创建成功后，被创建的worker会收到当前已有worker的列表，其他worker会收到新worker加入
 * 5 接收到新worker的通知后，通过id判断，判定是交由谁来进行主动连接
 * 
 * @param {*} file 
 * @param {*} args 
 */
boss.new_worker = async function (file, ...args)
{
    //大boss
    let id = 0

    if (boss.ceo == true)
    {
        if (data.mode == "process")
        {
            id = await boss._new_worker(file, ...args)
        }
        else
        {
            id = await boss._new_worker_vm(file, ...args)
        }
    }
    else
    {
        id = await boss.call_ceo("_new_worker", file, ...args)

        let worker = boss._new_woker_obj(id)

        data.workers.set(id, worker)
    }

    return id
}


boss._new_worker = async function (file, ...args)
{
    let full_path = path.resolve(file)
    let new_env = Object.assign(process.env)

    let id = boss.cluster << 13 | (++boss.id_helper)

    new_env.worker_id = id

    args.unshift(full_path)

    let worker = boss._new_woker_obj(id)

    data.workers.set(id, worker)

    console.log(`trying to new worker[${id}],file:${file}`)

    let child = child_process.fork(data.loader_path, args, {
        // detached: true,
        stdio: 'inherit',    //注意这三个的区别 : pipe,ignore,inherit
        env: new_env,        //环境变量 父子应该使用相同的环境变量
        // execArgv: process.env.execArgv,      //启动参数 这是只用于nodejs的命令行选项
    })

    child.on("exit", () =>
    {
        data.workers.delete(id)

        if (data.workers.size == 0)
        {
            process.exit(0)
        }
    })
    // child_process.stdout.on('data', data.old_log);
    // child_process.stderr.on('data', data.old_err);

    await awesome.wait(`rlogin[${id}]`)      //等待对端登陆成功

    return id
}

boss._login_remote = async function (worker)
{
    let standby = worker.standby

    worker.standby = null

    console.log("begin to login remote:" + worker.id)

    let regist_workers = await boss._call_worker(worker, "_login", boss.id)

    for (let buffer of standby)
    {
        worker.conn.write(buffer)
    }

    console.log("after login remote:" + worker.id)

    if (worker.id != boss.cluster)
    {
        awesome.wake(`llogin[${worker.id}]`)
        return
    }

    // console.dir(regist_workers)

    await boss._regist_workers(regist_workers)

    awesome.wake(`llogin[${worker.id}]`)
}

boss._login = async function (conn, id)
{
    let worker = data.workers.get(id)
    if (worker == null)         //表明比注册快，并且是对端主动连接
    {
        worker = boss._new_woker_obj(id)
        data.workers.set(id, worker)
    }

    conn.worker = worker
    worker.conn = conn

    for (let buffer of worker.standby)
    {
        conn.write(buffer)
    }

    worker.standby = null

    console.log(`recv login from: ${id}`)

    conn.dispatch = boss._after_login

    if (boss.ceo == false)
    {
        return
    }

    awesome.wake(`rlogin[${id}]`)       //远端登陆过来

    let regist_ids = [id]
    let ids = []

    for (let [exist_id, exist] of data.workers)
    {
        if (exist_id == boss.cluster)
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

        boss._send_worker(exist, "_regist_workers", regist_ids)

        ids.push(exist_id)
    }

    return ids
}

boss._on_invoke = function (worker, ...args)
{
    if (data.invoke)
    {
        data.invoke(...args)
    }
    else
    {
        console.log(`invoke from worker[${worker.id}]: ${args},but no handler,please use boss.on_invoke`)
    }
}
boss._on_call = async function (worker, session, ...args)
{
    if (data.call)
    {
        let ret = await data.call(...args)

        boss._ret_worker(worker, session, ret)
    }
    else
    {
        console.log(`call from worker[${worker.id}],but no handler,please use boss.on_call`)
    }
}
boss._on_resp = function (worker, session, ret)
{
    // console.log(`resp from worker[${worker.id}]: ${ret}`)

    awesome.wake(session, ret)
}

boss._on_inside_invoke = function (worker, func_name, ...args)
{
    // console.log(`invoke from [${worker.id}]:${func_name}(${args})`)

    boss[func_name](...args)
}
boss._on_inside_call = async function (worker, session, func_name, ...args)
{
    console.log(`call from [${worker.id}]: ${args}`)

    let ret = await boss[func_name](...args)

    boss._ret_worker(worker, session, ret)
}

boss._new_woker_obj = function (id)
{
    let worker = { id: id, standby: [] }

    worker.out_stream = new buffer_op.Stream()
    worker.out_writer = new buffer_op.Writer(worker.out_stream)

    return worker
}

boss._regist_workers = async function (ids)
{
    for (let id of ids)
    {
        if (id == boss.cluster)
        {
            continue
        }
        if (id >= boss.id)       //对方比我们大，等待对方链接
        {
            continue
        }
        let worker = data.workers.get(id)
        if (worker)
        {
            continue
        }
        worker = boss._new_woker_obj(id)

        data.workers.set(id, worker)

        //Todo 这里不用await，需要仔细思考一下是否ok
        boss._connect_worker(worker)
    }
}