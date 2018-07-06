# buffer-op
a toolset of how to handle buffer

# example
```js
let lib = require("buffer-op")

let stream = new lib.Stream(64)
let writer = new lib.Writer(stream)
let reader = new lib.Reader(stream)

{
    writer.append_int8(-10)
    writer.append_uint8(10)
    writer.append_int32(-1000)
    writer.append_uint32(1000)
    writer.append_string("this is a test")
    writer.append_double(10.4)
}

{
    let another = new lib.Stream()
    let another_writer = new lib.Writer(another)

    for (let i = 0, len = 20; i < len; ++i)
    {
        another_writer.append_string("this is gonna be a huge thing")
        another_writer.append_int32(-2342341)
    }

    writer.append_bytes(another)
}

{
    console.log(reader.read_int8())
    console.log(reader.read_uint8())

    console.log(reader.read_int32())
    console.log(reader.read_uint32())

    console.log(reader.read_string())
    console.log(reader.read_double())
}

{
    console.log("----------------------------")

    let buffer = reader.read_bytes()
    let another = new lib.Stream(buffer)
    let another_reader = new lib.Reader(another)

    for (let i = 0, len = 20; i < len; ++i)
    {
        console.log(another_reader.read_string())
        console.log(another_reader.read_int32())
    }

    console.log(another_reader.left_size())
}
```
