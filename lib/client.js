const nodeUrl = require('url')
const fs = require('fs')
const mkdirp = require('mkdirp')
const elementsInitializer = require('./element')
const {waitCondition, returnStringType, toElementObject} = require('./util')
const fetchyWrap = require('./fetchy')
const {initElement} = require('./byStrategy')
const {eventsList, eventsScripts} = require('./events')
const LOCAL = ['localhost', '127.0.0.1']
const {InterfaceError, handledErrors} = require('./interfaceError')
const {Keys} = require('./event/keys')
const initializator = require('./core')
const path = require('path')
const RUN_PROCCESS = require('./vars')

const mergeObjects = function(target = {}, initial) {
  Object.keys(initial).forEach(function(key) {
    if(typeof initial[key] === 'object' && !(initial[key] === null)) {
      target[key] = mergeObjects(target[key], initial[key])
    }
    if(!target[key] && !(key in target)) {
      target[key] = initial[key]
    }
  })
  return target
}

function StartProvider(config) {
  const {fork} = require('child_process')
  const forked = fork(path.resolve(__dirname, './webdriver.js'))
  forked.send({msg: 'startDriver', data: config})

  return new Promise(function(resolve) {
    forked.on('message', function({msg}) {
      if(msg === RUN_PROCCESS.SUCCESS_RUN) {
        resolve(forked)
      } else if(msg === RUN_PROCCESS.ADDRESS_IS_USE) {
        forked.kill()
        throw Error(RUN_PROCCESS.ADDRESS_IS_USE)
        resolve(RUN_PROCCESS.ADDRESS_IS_USE)
      } else if(msg === RUN_PROCCESS.UNHANDLED_EXCEPTION) {
        forked.kill()
        throw Error(RUN_PROCCESS.UNHANDLED_EXCEPTION)
        resolve(RUN_PROCCESS.UNHANDLED_EXCEPTION)
      } else if(msg === RUN_PROCCESS.DRIVER_NOT_FOUND) {
        forked.kill()
        throw Error(RUN_PROCCESS.DRIVER_NOT_FOUND)
        resolve(RUN_PROCCESS.UNHANDLED_EXCEPTION)
      } else if(msg === 'remote') {
        forked.kill()
        console.warn('Remote connection does not need local driver run')
        resolve(null)
      }
    })
  }).then(function(proc) {
    if(proc) {
      proc.on('message', function(msg) {if(msg === 'server stoped') {proc.kill()} })
      return proc
    }
  })
}

function WaitProviderStop(proc) {
  return new Promise(function(resolve) {
    proc.on('message', function(msg) {
      if(msg === 'server stoped') {resolve()}
    })
    proc.send({msg: 'stop'})
  })
}

/**
  * @param {string} dirPath path to directory
  * @returns {Promise}
  */
function createFullPath(dirPath) {
  return new Promise(function(resolve, reject) {
    mkdirp(dirPath, function(err) {
      err && reject(err)
      resolve()
    })
  })
}

/**
  * @param {object} requests object with all requests
  * @param {object} opts option, base url and desired capabilities
  * @returns {Client} client class
  */
function initializatorClient(requests, opts) {
  /**
  * @param {object} desiredCapabilities browser desired capabilities for selenium
  * @param {string} baseUrl base url
  */
  const {desiredCapabilities, baseUrl} = opts
  // browser part
  const {resizeWindow, killSession, initSession, goToUrl, getUrl, getTitle, forwardHistory, openTab} = requests
  const {refresh, alertText, alertSetText, moveTo, getScreenshot, windowRect, maximizeWindow} = requests
  const {getWindowSize, getCurrentWindowHandle, getCurrentWindowHandles, toFrame, doubleClick, pressKeys} = requests
  const {executeScript, sleep, backHistory, alertAccept, alertDismiss, closeCurrentTab, windowSource} = requests
  const {cookieClearAll, cookieGetAll, cookieClearOne, cookieSetOne, executeScriptAsync, minimizeWindow} = requests
  // mobile part
  const {closeApp, getContexts, launchApp, getCurrentActivity, getCurrentPackage, lock, reset, rotate, shake, touchClick} = requests
  const {touchDown, touchDoubleclick, touchLongclick, touchFlick, touchMove, touchUp, touchPerform, touchMultiperform, touchScroll} = requests

  /**
  * @param {funtion} action function from requests list
  * @param {array} rest all rest params what will go as arguments to action function
  * @returns {any} returns result from action
  */
  async function callWithWrap(that, action, ...rest) {
    if(!that.sessionId) {await that.getSession()}
    const driverResp = await action(that.sessionId, ...rest)
    const {err} = handledErrors(driverResp.status)
    if(err) err({sessionId: that.sessionId, additionalMessage: JSON.stringify(driverResp.value)})
    return driverResp.value
  }

  class Client {
    constructor() {
      this.eventsList = eventsList
      this.settings = opts
      this.Keys = Keys
      this.sessionId = null
      this.capabilities = desiredCapabilities
      this.seleniumProc = null
    }

    set elementInstace(elClass) {
      this.elementClass = elClass
    }
    // driver API
    /**
      * run driver servet
      * @returns {void}
      */
    async startDriver() {this.seleniumProc = await StartProvider(opts)}
    /**
      * stop driver servet
      * @returns {void}
      */
    async stopDriver() {if(this.seleniumProc) {await WaitProviderStop(this.seleniumProc)} }

    // standart API
    async pressKeys(...keys) {return callWithWrap(this, pressKeys, keys)}

    async pageSource() {return callWithWrap(this, windowSource)}

    async maximizeWindow() {return callWithWrap(this, maximizeWindow)}

    // need polyfill
    // async minimizeWindow() {return callWithWrap(this, minimizeWindow)}

    async back() {return callWithWrap(this, backHistory)}

    async getRect() {return callWithWrap(this, windowRect)}

    async forward() {return callWithWrap(this, forwardHistory)}

    async takeScreenshot() {return callWithWrap(this, getScreenshot)}

    async refresh() {return callWithWrap(this, refresh)}

    async closeCurrentTab() {return callWithWrap(this, closeCurrentTab)}

    async executeScript(script, ...args) {
      for(let i = 0; i < args.length; i++) {
        if(args[i] instanceof this.elementClass) {
          if(!args[i].elementId) {await args[i].getThisElement()}
          args[i] = toElementObject(args[i].elementId)
        }
      }
      return callWithWrap(this, executeScript, script, args)
    }

    async executeScriptAsync(script, ...args) {
      for(let i = 0; i < args.length; i++) {
        if(args[i] instanceof this.elementClass) {
          if(!args[i].elementId) {await args[i].getThisElement()}
          args[i] = toElementObject(args[i].elementId)
        }
      }
      return callWithWrap(this, executeScriptAsync, script, args)
    }

    async getUrl() {return callWithWrap(this, getUrl)}

    async sleep(time) {return sleep(time)}

    async getTitle() {return callWithWrap(this, getTitle)}

    async switchBack() {return callWithWrap(this, toFrame, null)}

    async getBrowserTabs() {return callWithWrap(this, getCurrentWindowHandles)}

    async getCurrentBrowserTab() {return callWithWrap(this, getCurrentWindowHandle)}

    async close() {if(this.sessionId) {return callWithWrap(this, killSession)} }

    async getSize() {
      const currentWindowId = await this.getCurrentBrowserTab()
      return callWithWrap(this, getWindowSize, currentWindowId)
    }

    async goTo(url) {
      if(!url) {console.error('url should not be empty string, null or undefined'); return }
      if(baseUrl) {url = nodeUrl.resolve(baseUrl, url)}
      if(!this.sessionId) {await this.getSession()}
      return callWithWrap(this, goToUrl, url)
    }

    async goToInNewTab(url) {
      return callWithWrap(this, executeScript, `window.open(arguments[0], '_blank')`, url)
    }

    async switchToTab(indexOrTabId) {
      if(isNaN(Number(indexOrTabId))) {
        return callWithWrap(this, openTab, indexOrTabId)
      } else {
        const tabs = await this.getBrowserTabs()
        if(tabs.length <= indexOrTabId) {
          return console.error('tabs quantity less then index')
        }
        return callWithWrap(this, openTab, tabs[indexOrTabId])
      }
    }

    async resizeWindow(width, height) {
      if(typeof width !== 'number' || typeof height !== 'number') {
        throw new InterfaceError('Width and height should be a number')
      }
      return callWithWrap(this, resizeWindow, {width, height})
    }

    async switchToFrame(element, time = 500) {
      if(!element.elementId) {
        await element.getThisElement()
        return callWithWrap(this, toFrame, element.elementId)
      } else {
        return callWithWrap(this, toFrame, element.elementId ? element.elementId : element)
      }
    }

    // session API
    async getSession() {
      const driverResp = await initSession({desiredCapabilities: this.capabilities})
      this.sessionId = driverResp.sessionId
      const {err} = handledErrors(driverResp.status)
      if(err) err({sessionId: this.sessionId, additionalMessage: JSON.stringify(driverResp.value)})
      if(this.timeouts) {
        const driverResp = await setScriptTimeout(this.sessionId, this.timeouts)
        const {err} = handledErrors(driverResp.status)
        if(err) err({sessionId: this.sessionId, additionalMessage: JSON.stringify(driverResp.value)})
      }
      return driverResp.value
    }

    async dispatchEvent(element, eventType) {
      if(!element.elementId) {await element.getThisElement()}
      await this.executeScript(eventsScripts[eventType], toElementObject(element.elementId))
    }

    // browser API {cookie, localStorage, sessionStorage, alert }
    get cookie() {
      // const {cookieClearAll, cookieGetAll, cookieClearOne, cookieSetOne} = requests
      return {
        set: async function(key, value) {
          return callWithWrap(this, cookieSetOne, {key: value})
        },
        get: async function(key) {
          return callWithWrap(this, cookieGetAll, key)
        },
        clear: async function() {
          return callWithWrap(this, cookieClearAll)
        },
        getAll: async function() {
          return callWithWrap(this, cookieGetAll)
        }
      }
    }

    get localStorage() {
      return {
        set: async function(key, value) {
          return callWithWrap(this, executeScript, function(key, value) {
            localStorage.setItem(key, value)
          }, [key, value])
        },
        get: async function(key) {
          return callWithWrap(this, executeScript, function(key) {return localStorage.getItem(key)}, key)
        },
        clear: async function() {
          return callWithWrap(this, executeScript, function() {localStorage.clear()})
        },
        getAll: async function() {
          return callWithWrap(this, executeScript, function() {
            return JSON.parse(JSON.stringify(localStorage))
          })
        }
      }
    }

    get alert() {
      const self = this
      return {
        accept: async function() {return callWithWrap(self, alertAccept)},
        dismiss: async function() {return callWithWrap(self, alertDismiss)},
        getText: async function() {return callWithWrap(self, alertText)},
        sendKeys: async function(text) {return callWithWrap(self, alertSetText, text)}
      }
    }

    get sessionStorage() {
      return {
        set: async function(key, value) {
          const driverResp = await executeScript(this.sessionId, function(data) {
            const [key, value] = data
            sessionStorage.setItem(key, value)
          }, [key, value])
          const {err} = handledErrors(driverResp.status)
          if(err) err({sessionId: this.sessionId, additionalMessage: JSON.stringify(driverResp.value)})
          return driverResp.value
        },
        get: async function(key) {
          const driverResp = await executeScript(this.sessionId, function(data) {
            const [key] = data
            return sessionStorage.getItem(key)
          }, key)
          const {err} = handledErrors(driverResp.status)
          if(err) err({sessionId: this.sessionId, additionalMessage: JSON.stringify(driverResp.value)})
          return driverResp.value
        },
        clear: async function() {
          const driverResp = await executeScript(this.sessionId, function() {sessionStorage.clear()})
          const {err} = handledErrors(driverResp.status)
          if(err) err({sessionId: this.sessionId, additionalMessage: JSON.stringify(driverResp.value)})
          return driverResp.value
        },
        getAll: async function() {
          const driverResp = await executeScript(this.sessionId, function() {
            return JSON.stringify(sessionStorage)
          })
          const {err} = handledErrors(driverResp.status)
          if(err) err({sessionId: this.sessionId, additionalMessage: JSON.stringify(driverResp.value)})
          return driverResp.value
        }
      }
    }

    async doubleClick(elemOrPosition) {
      if(!this.sessionId) {await this.getSession()}
      if(Object.prototype.hasOwnProperty.call(elemOrPosition, 'elementId') && !elemOrPosition.elementId) {
        await elemOrPosition.getThisElement()
        await callWithWrap(this, moveTo, {element: elemOrPosition.elementId})
      } else {
        await callWithWrap(this, moveTo, {xoffset: elemOrPosition.x, yoffset: elemOrPosition.y})
      }
      await callWithWrap(this, doubleClick)
    }

    async saveScreenshot(name = 'ScreenShot', params = {}) {
      if(!this.sessionId) {await this.getSession()}

      if(!name) {throw new Error('Name is obligatory to save screenshot')}
      const {
        path = `${process.cwd()}/screenshots`,
        encoding = 'base64',
        format = 'png',
        screenshot = await this.takeScreenshot()
      } = params
      const screenshotPath = `${path}/${name}.${format}`
      fs.existsSync(path) || await createFullPath(path)
      fs.writeFileSync(screenshotPath, screenshot, encoding)
    }

    // waiters API
    async waitForUrlIncludes(url, time) {
      if(!this.sessionId) {await this.getSession()}
      const condition = await waitCondition(getUrl.bind(this, this.sessionId), function({value}) {
        return value.includes(url)
      }, time)
      if(condition.err) throw new InterfaceError(`Url does not contain ${url} after time ${time} ms`)
    }

    async waitForTitleInclude(title, time) {
      if(!this.sessionId) {await this.getSession()}
      const condition = await waitCondition(getTitle.bind(this, this.sessionId), function({value}) {
        return value.includes(title)
      }, time)
      if(condition.err) throw new InterfaceError(`Title does not contain ${title} after time ${time} ms`)
    }

    async wait(...args) {
      const [time, cb, message] = args
      const self = this
      const now = +Date.now()
      const thisCall = async function(...args) {
        self.sessionId = self.sessionId || client.sessionId
        do {
          const result = cb.then || returnStringType(cb) === '[object AsyncFunction]' ? await cb() : cb()
          if(result) return {time: time - (Date.now() - now)}
          await sleep()
        } while(Date.now() - now < time)
        return
      }
      const result = await thisCall()
      if(result.time) {return }
      throw new InterfaceError(message ? message : `Wait condition fail ${time}`)
    }
  }
  return Client
}

const defautlOpts = {
  remote: false,
  directConnect: false,
  desiredCapabilities: {
    javascriptEnabled: true,
    acceptSslCerts: true,
    platform: 'ANY',
    browserName: 'chrome'
  },
  host: 'localhost',
  port: 4444,
  timeout: 5000
}

module.exports = function(opts = defautlOpts) {
  let baseRequestUrl = null
  !opts.mobile && (opts = mergeObjects(opts, defautlOpts))

  const {remote, directConnect, host, port, timeout, slowTime = 0} = opts

  if(LOCAL.includes(host) && !remote) {

    baseRequestUrl = !directConnect ? `http://127.0.0.1:${port}/wd/hub/` : `http://127.0.0.1:${port}/`

  } else if(remote) {
    baseRequestUrl = host
    baseRequestUrl = baseRequestUrl[baseRequestUrl.length - 1] === '/' ? baseRequestUrl : `${baseRequestUrl}/`
  }
  const fetchy = fetchyWrap(slowTime)

  const baseRequest = {
    get: fetchy.bind(fetchy, "GET", baseRequestUrl, timeout),
    post: fetchy.bind(fetchy, "POST", baseRequestUrl, timeout),
    put: fetchy.bind(fetchy, "PUT", baseRequestUrl, timeout),
    del: fetchy.bind(fetchy, "DELETE", baseRequestUrl, timeout)
  }

  const requests = initializator(baseRequest)

  const Client = initializatorClient(requests, opts)

  const client = new Client()

  const {ElementAWB, ElementsAWB} = elementsInitializer(requests, client)
  client.elementInstace = ElementAWB
  const element = initElement(undefined, ElementAWB)
  const elements = initElement(undefined, ElementsAWB)

  const $ = element
  const $$ = elements

  return {
    $, $$,
    element,
    elements,
    client
  }
}
