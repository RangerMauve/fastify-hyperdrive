const makeFetch = require('hypercore-fetch')
const { Readable } = require('stream')

module.exports = createServeHyperdrive

function createServeHyperdrive (Hyperdrive, {
  writable = false,
  ...opts
} = {}) {
  const fetch = makeFetch({ Hyperdrive, writable, ...opts })

  return async function serveHyperdrive (request, reply) {
    const { headers, params, method } = request
    const { key, '*': path } = params

    const url = `hyper://${key}/${path}`

    const response = await fetch(url, {
      method,
      headers
    })

    for (const [header, value] of response.headers) {
      reply.header(header, value)
    }

    reply.status(response.status)
    reply.send(Readable.from(response.body))
  }
}
