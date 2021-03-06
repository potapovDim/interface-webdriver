const getLocalEnv = require('./env')

const {baseOptions, urlPathes} = getLocalEnv()

/**
   * @param {string} sessionId .
   * @param {string} selector css selector.
   * @param {object} options options.
 */

module.exports = function(request) {
  return async function(sessionId, selector, options) {
    if(!options) options = {...baseOptions}
    const {body} = await request.post(urlPathes.elements(sessionId), JSON.stringify(selector), options)
    body.value = body.value.map(respPart => {
      return {ELEMENT: respPart[Object.keys(respPart)[0]]}
    })
    return body
  }
}
