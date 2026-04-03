import { strict as assert } from 'assert'
import { before, describe, it } from 'mocha'
import * as cheerio from 'cheerio'

import { ReadComicsOnlineParser } from './ReadComicsOnlineParser'
import { installAppMock } from '../testUtils/mockApp'

describe('ReadComicsOnlineParser', () => {
    before(() => {
        installAppMock()
    })

    it('parses grid cards with normalized image urls', () => {
        const parser = new ReadComicsOnlineParser()
        const html = `
        <div class="list-container">
          <div class="row">
            <div class="media">
              <div class="media-left"><img src="/uploads/manga/one-piece/cover_250x350.jpg" /></div>
              <h5 class="media-heading"><a href="/comic/one-piece">One Piece</a></h5>
            </div>
          </div>
        </div>
        `
        const $ = cheerio.load(html)
        const items = parser.parseGridItems($)

        assert.equal(items.length, 1)
        assert.equal(items[0].mangaId, 'one-piece')
        assert.equal(items[0].title, 'One Piece')
        assert.equal(items[0].image, 'https://readcomicsonline.ru/uploads/manga/one-piece/cover.jpg')
    })

    it('parses ajax search suggestions', () => {
        const parser = new ReadComicsOnlineParser()
        const results = parser.parseSearchJson({
            suggestions: [
                {value: 'Batman', data: 'batman-id'},
            ],
        })

        assert.equal(results.length, 1)
        assert.equal(results[0].mangaId, 'batman-id')
        assert.equal(results[0].title, 'Batman')
    })
})
