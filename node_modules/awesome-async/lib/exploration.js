let exploration = require("./head")

let data = {}

/**
 * 
 * @param {} name 
 * @return [is_captured,the result]
 */
exploration.capture = async function (name)
{
    let exist = data[name]

    if (exist == null)
    {
        data[name] = []
        return [true]
    }

    return new Promise((resolve) =>
    {
        exist.push(resolve)
    })
}

/**
 * 
 * @param {*} name 
 * @param {*} result 
 */
exploration.share = function (name, result)
{
    let exist = data[name]
    if (exist == null)
    {
        return
    }

    delete data[name]

    let ret = [false, result]

    for (let i = 0, len = exist.length; i < len; ++i)
    {
        let resolve = exist[i]

        resolve(ret)
    }
}

