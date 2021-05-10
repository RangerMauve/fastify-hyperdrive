const fastify = require('fastify')
const SDK = require('dat-sdk')
const fetch = require('cross-fetch')
const test = require('tape')

const fastifyHyperdrive = require('./')

test('Load data from drive through server', async (t) => {
  const { close, address, Hyperdrive } = await setup()
  try {
    const drive = Hyperdrive('example')

    await drive.writeFile('/example.txt', 'Example')

    const toFetch = new URL(`/${drive.key.toString('hex')}/example.txt`, address)

    const response = await fetch(toFetch.href)

    t.pass('Got response')
    t.equals(response.status, 200)
    t.equals(response.headers.get('hyperdrive-version'), '2')
    t.equals(response.headers.get('content-type'), 'text/plain')
    t.equals(response.headers.get('content-length'), '7')
    t.equals(response.headers.get('accept-ranges'), 'bytes')

    const text = await response.text()

    t.equal(text, 'Example', 'Got file contents')
  } finally {
    close()
  }
})

test('404 error for unknown files', async (t) => {
  const { close, address, Hyperdrive } = await setup()
  try {
    const drive = Hyperdrive('example')

    await drive.writeFile('/example.txt', 'Example')

    const toFetch = new URL(`/${drive.key.toString('hex')}/other.txt`, address)

    const response = await fetch(toFetch.href)

    t.pass('Got response')
    t.equals(response.status, 404)
    t.equals(response.headers.get('hyperdrive-version'), '2')
    t.equals(response.headers.get('content-type'), 'text/plain; charset=utf-8')
    t.equals(response.headers.get('content-length'), '9')

    const text = await response.text()

    t.equal(text, 'Not Found', 'Got file contents')
  } finally {
    close()
  }
})

test('directory lookup', async (t) => {
  const { close, address, Hyperdrive } = await setup()
  try {
    const drive = Hyperdrive('example')

    await drive.writeFile('/example/b.txt', 'b')
    await drive.writeFile('/example/a.txt', 'a')

    const toFetch = new URL(`/${drive.key.toString('hex')}/example`, address)

    const response = await fetch(toFetch.href)

    t.pass('Got response')
    t.equals(response.status, 200)
    t.equals(response.headers.get('hyperdrive-version'), '3')
    t.equals(response.headers.get('content-type'), 'text/html')
    t.equals(response.headers.get('content-length'), '433')

    const text = await response.text()

    t.equal(text, `
          <!DOCTYPE html>
          <title>${drive.key.toString('hex')}/example</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <h1>Index of example</h1>
          <ul>
            <li><a href="../">../</a></li>
            <li><a href="b.txt">./b.txt</a></li>
          
            <li><a href="a.txt">./a.txt</a></li>
          </ul>
        `, 'Got file contents')
  } finally {
    close()
  }
})

async function setup () {
  const sdk = await SDK({ persist: false })
  const { Hyperdrive, resolveName } = sdk

  async function getHyperdrive (key) {
    const resolved = await resolveName(key)
    return Hyperdrive(resolved)
  }

  const server = fastify({ logger: false })
  server.get('/:key/*path', fastifyHyperdrive(getHyperdrive))
  try {
    return {
      sdk,
      Hyperdrive: sdk.Hyperdrive,
      address: await new Promise((resolve, reject) => {
        server.listen(0, (err, address) => {
          if (err) reject(err)
          else resolve(address)
        })
      }),
      close () {
        sdk.close()
        server.close()
      }
    }
  } catch (err) {
    sdk.close()
    throw err
  }
}
