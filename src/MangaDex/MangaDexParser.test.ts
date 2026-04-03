import { strict as assert } from 'assert'
import { before, describe, it } from 'mocha'

import { MangaDexParser } from './MangaDexParser'
import { installAppMock } from '../testUtils/mockApp'

describe('MangaDexParser', () => {
    before(() => {
        installAppMock()
    })

    it('parses search results with cover relationship', () => {
        const parser = new MangaDexParser()
        const data = {
            data: [
                {
                    id: 'abc-123',
                    attributes: {
                        title: {en: 'One Piece'},
                        status: 'ongoing',
                    },
                    relationships: [
                        {type: 'cover_art', attributes: {fileName: 'cover-file'}},
                    ],
                },
                {
                    id: 'def-456',
                    attributes: {
                        title: {en: 'Monster'},
                        status: 'completed',
                    },
                    relationships: [],
                },
            ],
        }

        const results = parser.parseSearchResults(data)

        assert.equal(results.length, 2)
        assert.equal(results[0].mangaId, 'abc-123')
        assert.equal(results[0].title, 'One Piece')
        assert.equal(results[0].subtitle, 'Ongoing')
        assert.match(results[0].image, /uploads\.mangadex\.org/)
        assert.equal(results[1].subtitle, 'Completed')
    })
})
