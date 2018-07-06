let Stream = require("./Stream")
let Reader = require("./Reader")
let Writer = require("./Writer")

let box = module.exports = {}

let types = {
    null: 0,
    integer: 1,
    double: 2,
    boolean: 3,
    string: 4,
    array: 5,
    object: 6,
    buffer: 7,
    stream: 8,
    set: 9,
    map: 10,
}

box.pack = function (...args)
{
    let stream = new Stream()
    let writer = new Writer(stream)

    if (args.length == 0)
    {
        box.pack_any(writer)
    }
    else
    {
        box.pack_any(writer, args)
    }

    return stream
}

box.unpack = function (stream)
{
    if (stream instanceof Buffer)
    {
        stream = new Stream(stream)
    }

    let reader = new Reader(stream)

    let target = box.unpack_any(reader)

    return target
}

//---------------------------------------
// 以下是序列化的接口
box.pack_any = function (writer, target)
{
    if (target == null)
    {
        writer.append_uint8(0)
        return
    }

    let tp = typeof (target)
    switch (tp)
    {
        case "number":
            box.pack_number(writer, target) //tp + val
            break
        case "string":
            box.pack_string(writer, target)
            break
        case "boolean":
            box.pack_bool(writer, target)
            break
        case "object":
            if (target instanceof Array)
            {
                box.pack_array(writer, target)
            }
            else if (target instanceof Set)
            {
                box.pack_set(writer, target)
            }
            else if (target instanceof Map)
            {
                box.pack_map(writer, target)
            }
            else if (target instanceof Buffer)
            {
                box.pack_buffer(writer, target)
            }
            else if (target instanceof Stream)
            {
                box.pack_stream(writer, target)
            }
            else
            {
                box.pack_obj(writer, target)
            }
            break

    }
}

box.pack_number = function (writer, target)
{
    if (Number.isInteger(target))
    {
        if (-0x80000000 <= target && target <= 0x7fffffff)
        {
            writer.append_uint8(types.integer)
            writer.append_int32(target)
        }
        else if (Number.isSafeInteger(target))
        {
            writer.append_uint8(types.double)
            writer.append_double(target)
        }
        else
        {
            new Error(`not support value range to pack into stream:${target}`)
        }
    }
    else
    {
        writer.append_uint8(types.double)
        writer.append_double(target)
    }
}

box.pack_string = function (writer, target)
{
    writer.append_uint8(types.string)
    writer.append_string(target)
}

box.pack_bool = function (writer, target)
{
    writer.append_uint8(types.boolean)
    writer.append_uint8(target ? 1 : 0)
}

box.pack_array = function (writer, target)
{
    writer.append_uint8(types.array)
    writer.append_uint16(target.length)

    for (let i = 0, len = target.length; i < len; ++i)
    {
        box.pack_any(writer, target[i])
    }
}

box.pack_obj = function (writer, target)
{
    writer.append_uint8(types.object)

    let position = writer.offset

    writer.append_uint16(0)

    let len = 0
    for (let key in target)
    {
        let val = target[key]

        box.pack_any(writer, key)
        box.pack_any(writer, val)

        len++
    }

    writer.replace_uint16(len, position)
}

box.pack_set = function (writer, target)
{
    writer.append_uint8(types.set)
    writer.append_uint16(target.size)

    for (let val of target)
    {
        box.pack_any(writer, val)
    }
}

box.pack_map = function (writer, target)
{
    writer.append_uint8(types.map)
    writer.append_uint16(target.size)

    for (let [key, val] of target)
    {
        box.pack_any(writer, key)
        box.pack_any(writer, val)
    }
}

box.pack_buffer = function (writer, target)
{
    writer.append_uint8(types.buffer)
    writer.append_bytes(target)
}

box.pack_stream = function (writer, target)
{
    writer.append_uint8(types.stream)
    writer.append_bytes(target)
}
//---------------------------------------------------
//以下是反序列化的结果

box.unpack_any = function (reader)
{
    let tp = reader.read_uint8()
    let ret = null

    switch (tp)
    {
        case types.null:
            break
        case types.integer:
            ret = box.unpack_integer(reader)
            break
        case types.double:
            ret = box.unpack_double(reader)
            break
        case types.boolean:
            ret = box.unpack_boolean(reader)
            break
        case types.string:
            ret = box.unpack_string(reader)
            break
        case types.array:
            ret = box.unpack_array(reader)
            break
        case types.object:
            ret = box.unpack_obj(reader)
            break
        case types.buffer:
            ret = box.unpack_buffer(reader)
            break
        case types.stream:
            ret = box.unpack_stream(reader)
            break
        case types.set:
            ret = box.unpack_set(reader)
            break
        case types.map:
            ret = box.unpack_map(reader)
            break
    }

    return ret
}

box.unpack_integer = function (reader)
{
    return reader.read_int32()
}

box.unpack_double = function (reader)
{
    return reader.read_double()
}
box.unpack_boolean = function (reader)
{
    return reader.read_uint8() == 1
}
box.unpack_string = function (reader)
{
    return reader.read_string()
}
box.unpack_array = function (reader)
{
    let len = reader.read_uint16()
    let ret = []

    for (let i = 0; i < len; ++i)
    {
        let val = box.unpack_any(reader)
        ret.push(val)
    }

    return ret
}
box.unpack_obj = function (reader)
{
    let len = reader.read_uint16()
    let ret = {}

    for (let i = 0; i < len; ++i)
    {
        let key = box.unpack_any(reader)
        let val = box.unpack_any(reader)

        ret[key] = val
    }

    return ret
}
box.unpack_set = function (reader)
{
    let len = reader.read_uint16()
    let ret = new Set()

    for (let i = 0; i < len; ++i)
    {
        let val = box.unpack_any(reader)
        ret.add(val)
    }
    return ret
}
box.unpack_map = function (reader)
{
    let len = reader.read_uint16()
    let ret = new Map()

    for (let i = 0; i < len; ++i)
    {
        let key = box.unpack_any(reader)
        let val = box.unpack_any(reader)

        ret.set(key, val)
    }
    return ret
}
box.unpack_buffer = function (reader)
{
    let buffer = reader.read_bytes()

    return buffer
}

box.unpack_stream = function (reader)
{
    let buffer = reader.read_bytes()

    return new Stream(buffer)
}