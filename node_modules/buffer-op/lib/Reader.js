class Reader
{
    constructor(stream)
    {
        this._offset = 0
        this._stream = stream
    }

    read_int32()
    {
        if (this.enough(4) == false)
        {
            return 0
        }

        let buffer = this._stream.buffer
        let num = buffer.readInt32LE(this._offset)

        this._offset += 4

        return num
    }
    read_uint32()
    {
        if (this.enough(4) == false)
        {
            return 0
        }

        let buffer = this._stream.buffer
        let num = buffer.readUInt32LE(this._offset)

        this._offset += 4

        return num
    }

    read_int16()
    {
        if (this.enough(2) == false)
        {
            return 0
        }

        let buffer = this._stream.buffer
        let num = buffer.readInt16LE(this._offset)

        this._offset += 2

        return num
    }
    read_uint16()
    {
        if (this.enough(2) == false)
        {
            return 0
        }

        let buffer = this._stream.buffer
        let num = buffer.readUInt16LE(this._offset)

        this._offset += 2

        return num
    }

    read_int8()
    {
        if (this.enough(1) == false)
        {
            return 0
        }

        let buffer = this._stream.buffer
        let num = buffer.readInt8(this._offset)

        this._offset += 1

        return num
    }
    read_uint8()
    {
        if (this.enough(1) == false)
        {
            return 0
        }

        let buffer = this._stream.buffer
        let num = buffer.readUInt8(this._offset)

        this._offset += 1

        return num
    }
    read_double()
    {
        if (this.enough(8) == false)
        {
            return 0
        }

        let buffer = this._stream.buffer
        let num = buffer.readDoubleLE(this._offset)

        this._offset += 8

        return num
    }

    read_string()
    {
        if (this.enough(2) == false)
        {
            return
        }

        let len = this.read_uint16()
        if (this.enough(len) == false)
        {
            return ""
        }
        let buffer = this._stream.buffer
        let str = buffer.toString("utf8", this._offset, this._offset + len)

        this._offset += len

        return str
    }

    read_bytes()
    {
        if (this.enough(2) == false)
        {
            return
        }

        let len = this.read_uint16()
        if (this.enough(len) == false)
        {
            return Buffer.allocUnsafe(0)
        }
        let target_buffer = Buffer.allocUnsafe(len)
        let buffer = this._stream.buffer

        buffer.copy(target_buffer, 0, this._offset, this._offset + len)

        this._offset += len

        return target_buffer
    }

    left_size()
    {
        return this._stream.length - this._offset
    }
    enough(size)
    {
        return this.left_size() >= size
    }


}

module.exports = Reader