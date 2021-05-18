const resolvePathCB = require('resolve-dat-path')
const mime = require('mime/lite')
const parseRange = require('range-parser')

module.exports = createServeHyperdrive

function createServeHyperdrive (getHyperdrive) {
  return async function serveHyperdrive (request, reply) {
    const { headers, params, method } = request
    const { key, '*': path } = params

    if (path === '.well-known/dat') {
      return `dat://${key}\nttl=3600`
    }

    const drive = await getHyperdrive(key)
    if (!drive) {
      reply.status(404)
      return 'Unknown drive'
    }

    try {
      const { type, path: finalPath, stat } = await resolvePath(drive, path)

      if (type === 'directory') {
        const stats = await drive.readdir(finalPath, { includeStats: true })
        const files = stats.map(({ stat, name }) => (stat.isDirectory() ? `${name}/` : name))

        reply.header('Hyperdrive-Version', drive.version)
        reply.header('Content-Type', 'text/html')

        if (method !== 'GET') return ''
        return `
          <!DOCTYPE html>
          <title>${key}/${path}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <h1>Index of ${path}</h1>
          <ul>
            <li><a href="../">../</a></li>${files.map((file) => `
            <li><a href="${file}">./${file}</a></li>
          `).join('')}</ul>
        `
      } else if (type === 'file') {
        reply.header('Hyperdrive-Version', drive.version)
        reply.header('Content-Type', mime.getType(finalPath) || 'text/plain')
        reply.header('Accept-Ranges', 'bytes')

        const isRanged = headers.Range || headers.range
        const { size } = stat

        if (isRanged) {
          const range = parseRange(size, isRanged)[0]
          if (range && range.type === 'bytes') {
            reply.status(206)
            const { start, end } = range
            const length = (end - start + 1)
            reply.header('Content-Length', `${length}`)
            reply.header('Content-Range', `bytes${start}-${end}/${size}`)

            if (method !== 'GET') return ''

            reply.send(drive.createReadStream(finalPath, {
              start,
              end
            }))
            return
          }
        }

        reply.header('Content-Length', `${size}`)

        if (method !== 'GET') return ''
        reply.send(drive.createReadStream(finalPath))
      } else {
        throw new Error(`Could not resolve path: ${key} ${path} :${type}`)
      }
    } catch (e) {
      reply.header('Hyperdrive-Version', drive.version)
      reply.status(404)

      return e.message
    }
  }
}

async function resolvePath (drive, path) {
  return new Promise((resolve, reject) => {
    resolvePathCB(drive, path, (err, resolved) => {
      if (err) reject(err)
      else resolve(resolved)
    })
  })
}
