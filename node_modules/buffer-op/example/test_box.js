let box = require("../lib").box

{
    let stream = box.pack()

    console.dir(box.unpack(stream))
}

{
    let helper = box.pack(true, null, "1111111")
    let stream = box.pack(
        { a: 1, b: 2.3, c: true, d: "this is something" },
        "this is a test",
        helper)

    let [a, b, c] = box.unpack(stream)

    console.dir(a)
    console.dir(b)
    console.dir(c)

    console.dir(box.unpack(c))
}