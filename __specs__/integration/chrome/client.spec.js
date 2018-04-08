const {expect} = require('chai')

const awb = require('../../../awb')

const {element, elements, $, $$, client} = awb()

const pathResolver = (name) => {
  const resolvedPath = require('path').resolve(__dirname, `../../spec_utils/${name}.html`)
  return `file://${resolvedPath}`
}

describe('client chrome', () => {
  before(async () => {
    await client.startDriver()
  })

  after(async () => {
    await client.close()
    await client.stopDriver()
  })

  it('allert', async () => {
    const file = 'alert'
    await client.goTo(pathResolver(file))
    const clicker = element('#test_button')
    await clicker.click()
    expect(await client.alert.getText()).to.eql('Hello')
    await client.alert.accept()
  })

  it('clicker', async () => {
    const file = 'clicker'
    await client.goTo(pathResolver(file))
    const clicker = element('#test_button')
    const spanArr = elements('span')
    await clicker.click()
    expect(await spanArr.count()).to.eql(1)
    await clicker.click()
    expect(await spanArr.count()).to.eql(2)
  })

  it('input', async () => {
    const file = 'input'
    await client.goTo(pathResolver(file))
    const input = element('input')
    await input.sendKeys('test1')
    expect(await input.getAttribute('value')).to.eql('test1')
    await element('body').click()
    const spanArr = elements('span')
    expect(await spanArr.count()).to.eql(1)
  })

  it('execute script', async () => {
    const file = 'clicker'
    const clicker = element('#test_button')
    await client.goTo(pathResolver(file))
    await clicker.click()
    await clicker.click()

    const res = await client.executeScript(function() {
      return document.querySelectorAll('span').length
    })
    expect(res).to.eql(2)
    const res1 = await client.executeScript(`
      const text = arguments[0]
      let condition = true
      const spanArr = document.querySelectorAll('span').length
      const emptyArr = []
      emptyArr.forEach.call(spanArr, (el) =>{
        if(el.innerText !== text) {
          condition = false
        }
      })
      return condition
    `, 'test')
    expect(res1).to.eql(true)
  })

  it('appear', async () => {
    const file = 'appear'
    const clicker = element('#test_button')
    const link = element('a').waitForElement(1700)
    await client.goTo(pathResolver(file))
    await clicker.click()
    expect(await link.isDisplayed()).to.eql(true)
  })

  it('disappear', async () => {
    const file = 'disappear'
    const clicker = element('#test_button')
    await client.goTo(pathResolver(file))
    try {
      await clicker.waitUntilDisappear(1000)
    } catch(error) {
      expect(error.toString().includes('still present on page'))
    }
    const time = await clicker.waitUntilDisappear(5000)

    expect(time).to.not.eq(0)
  })

  it('wait cb', async () => {
    const file = 'wait'
    const clicker = element('#test_button')
      .wait(1000, async (el) => await el.isDisplayed() === true)
      .wait(3500, async (el) => await el.getText() === 'Button test')
    await client.goTo(pathResolver(file))
    await clicker.click()
  })

  it('appear elements', async () => {
    const file = 'appearArr'
    const links = elements('a').waitForElements(15000)
    await client.goTo(pathResolver(file))
    expect(await links.count()).to.not.eq(0)
  })

  it('wait arr cb ', async () => {
    const file = 'appearArr'
    const link = elements('a').wait(15000, async (els) => await els.count() > 7).get(3)
    await client.goTo(pathResolver(file))
    expect(await link.getText()).to.eq('Super link')
  })

  it('disappear arr', async () => {
    const file = 'desappearArr'
    const links = elements('a')
    await client.goTo(pathResolver(file))
    await links.waitUntilDisappear(10000)
  })

  it('disappear arr negative', async () => {
    const file = 'desappearArr'
    const links = elements('a')
    await client.goTo(pathResolver(file))
    await links.waitUntilDisappear(1000)
  })

  it('iframe', async () => {
    const file = 'iframe'
    const buttonYoutube = $('.ytp-large-play-button.ytp-button')
    const clicker = element('#test_button')
    await client.goTo(pathResolver(file))
    await client.switchToFrame(element('#youtube'))
    expect(await buttonYoutube.isDisplayed()).to.eql(true)
    expect(await clicker.isDisplayed()).to.eql(false)
  })

  it('switch', async () => {
    const file = 'iframe'
    const buttonYoutube = $('.ytp-large-play-button.ytp-button')
    const clicker = element('#test_button')
    await client.goTo(pathResolver(file))
    await client.switchToFrame(element('#youtube'))
    expect(await buttonYoutube.isDisplayed()).to.eql(true)
    expect(await clicker.isDisplayed()).to.eql(false)
    await client.switchBack()
    expect(await clicker.isDisplayed()).to.eql(true)
  })

  it('localstorage', async () => {
    const file = 'localstorage'
    const clicker = element('#test_button')
    await client.goTo(pathResolver(file))
    await clicker.click()
    const localStorage = client.localStorage

    expect(await localStorage.getAll()).to.eql({
      test: '{"first":1,"second":2}'
    })

    expect(await localStorage.get('test')).to.eql(
      '{"first":1,"second":2}'
    )

    await localStorage.set('testy', JSON.stringify({first: 1, second: 2}))

    expect(await localStorage.getAll()).to.eql({
      test: '{"first":1,"second":2}',
      testy: JSON.stringify({first: 1, second: 2})
    })

    await localStorage.clear()
    expect(await localStorage.getAll()).to.eql({})
  })

  it('subelements', async () => {
    const file = 'subelement'
    const clicker = element('#test_button')
    const link = elements('a').wait(1200, async (el) => await el.count() === 8).get(3)
    await client.goTo(pathResolver(file))
    await clicker.click()
    expect(await link.getText()).to.eql('link 5')
  })
})
