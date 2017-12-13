const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const START_SUCCESS_STACK = 'INFO - Selenium Server is up and running'
const ALREADY_IN_USE = 'java.lang.RuntimeException: java.net.BindException: Address already in use'

const DEFAULT_PORT = 4444
const DEFAULT_HOST = '127.0.0.1'

const GECKO_PATH = '../geckodriver'
const CHROME_PATH = '../chromedriver_2.33'
const STANDALONE_PATH = '../selenium-server-standalone-3.7.1.jar'

const resolvePath = (pathTofile) => path.resolve(__dirname, pathTofile)

class SeleniumServer {

  constructor(settings, callback) {
    this.settings = settings
    this.startCb = callback

    this.port = this.settings.port || DEFAULT_PORT
    this.host = this.settings.host || DEFAULT_HOST
    this.output = ''
    this.process = null
  }

  start() {
    const self = this
    return new Promise((resolve) => {

      const args = []

      if (typeof this.settings.browserDrivers == 'object') {
        if (this.settings.browserDrivers.chrome && typeof this.settings.browserDrivers.chrome === 'string') {
          args.push(`-Dwebdriver.chrome.driver=${resolvePath(CHROME_PATH)}`)
        }
        if (this.settings.browserDrivers.gecko && typeof this.settings.browserDrivers.gecko == 'string') {
          args.push(`-Dwebdriver.gecko.driver=${resolvePath(GECKO_PATH)}`)
        }
      }

      args.push('-jar', `${resolvePath(STANDALONE_PATH)}`)

      self.process = spawn('java', args)


      self.exitHandler = self.exit.bind(self)


      self.process.on('error', (err) => {
        if (err.code == 'ENOENT') {
          console.log(`Something went wrong ${err.message}`)
        }
      })

      self.process.on('exit', this.exitHandler)

      self.process.on('close', () => {
        console.log('Selenium process stopped')
      })

      self.process.stdout.on('data', (data) => {
        var output = data.toString()
        this.output += output
        const isStarted = this.output.includes(START_SUCCESS_STACK)

        if (isStarted) {
          const exitHandler = self.exitHandler

          self.process.removeListener('exit', exitHandler)

          self.startCb(null, self.process)
        }
      })

      self.process.stderr.on('data', (data) => {
        const output = data.toString()
        self.output += output
        const isStarted = this.output.includes(START_SUCCESS_STACK)
        console.log('!1!', self.output)
        const isAddressInUse = this.output.includes(ALREADY_IN_USE)

        if (isAddressInUse) {
          self.startCb('Selenium already started on port 444')
          resolve(true)
        }

        if (isStarted) {

          const exitHandler = self.exit

          self.process.removeListener('exit', exitHandler)
          self.startCb(null, self.process)
        }
      })
      resolve(true)
    })

  }

  stop(cb) {
    if (!this.process || this.process.killed) {
      console.log('Something went wrong')
      callback(false)
      return
    }
    try {
      this.process.kill()
      this.writeLogFile(cb)
    } catch (e) {
      console.log(e.toString())
      cb()
    }
  }

  exit(code) {
    this.startCb('Selenium process exit', code)
  }

  writeLogFile(cb) {

    const filePath = path.resolve(path.join(process.cwd(), 'debug.log'))

    fs.writeFile(filePath, this.output, function (err) {
      if (err) {
        console.log(console.log.colors.light_red('\nError writing log file to:'), err.path)
      }
      cb && cb()
    })
  }
}




const server = new SeleniumServer({
  standAlonePath: `${path.resolve(process.cwd(), './selenium-server-standalone-3.7.1.jar')}`,
  host: "127.0.0.1",
  port: 4444,
  browserDrivers: {
    chrome: `${path.resolve(process.cwd(), './chromedriver_2.33')}`
  }
}, (data) => {
  console.log(data)
  server.stop(() => { console.log('STOPED') })
})

server.start()