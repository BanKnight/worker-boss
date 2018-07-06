let mutex = require("./head")

let data = {}

/**
 * lock the mutex by the given name,when it get the lock,
 * it returen right once,otherwise pause until someone unlock it
 * 
 * @param {name} key 
 */
mutex.lock = async function (name)
{
    let exist = data[name]

    if (exist == null)
    {
        data[name] = []
        return
    }

    return new Promise((resolve) =>
    {
        exist.push(resolve)
    })
}

/**
 * release the lock
 * @param {lock-name} name 
 */
mutex.unlock = function (name)
{
    let exist = data[name]
    if (exist == null)
    {
        return
    }

    if (exist.length == 0)
    {
        delete data[name]
        return
    }

    exist.shift()()
}
/**
 * try get the lock,return immediately even it fails
 */
mutex.try_lock = function (name)
{
    let exist = data[name]

    if (exist == null)
    {
        data[name] = []
        return true
    }

    return false
}
/**
 * 
 * @param {*} name 
 * @param {*} cb 
 */
mutex.safe_lock = async function (name, cb)
{
    try
    {
        await mutex.lock(name)

        cb()
    }
    catch (e)
    {
        mutex.unlock(name)
        throw e
    }

    mutex.unlock(name)
}
