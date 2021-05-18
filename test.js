const fastify = require('fastify')
const SDK = require('dat-sdk')
const fetch = require('cross-fetch')
const test = require('tape')

const fastifyHyperdrive = require('./')

test('Load data from drive through server', async (t) => {
  let sdk = null
  let server = null
  try {
    sdk = await SDK({ persist: false })

    const { Hyperdrive, resolveName } = sdk

    async function getHyperdrive (key) {
      const resolved = await resolveName(key)
      return Hyperdrive(resolved)
    }

    server = fastify({ logger: false })

    server.get('/:key/*path', fastifyHyperdrive(getHyperdrive))

    const address = await new Promise((resolve, reject) => {
      server.listen(0, (err, address) => {
        if (err) reject(err)
        else resolve(address)
      })
    })

    const drive = Hyperdrive('example')

    await drive.writeFile('/example.txt', 'Example')

    const toFetch = new URL(`/${drive.key.toString('hex')}/example.txt`, address)

    const response = await fetch(toFetch.href)

    t.pass('Got response')

    const text = await response.text()

    t.equal(text, 'Example', 'Got file contents')

    t.end()
  } catch (e) {
    t.error(e.stack)
  } finally {
    if (sdk) sdk.close()
    if (server) server.close()
  }
})
