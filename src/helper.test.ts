import { strict as assert } from 'assert'
import { describe, it } from 'mocha'

import { URLBuilder } from './helper'

describe('URLBuilder', () => {
    it('builds urls with path and encoded params', () => {
        const url = new URLBuilder('https://example.com')
            .addPathComponent('/api/')
            .addPathComponent('v1')
            .addQueryParameter('q', 'one piece')
            .addQueryParameter('lang', 'it')
            .buildUrl()

        assert.equal(url, 'https://example.com/api/v1?q=one%20piece&lang=it')
    })

    it('supports array and object parameters', () => {
        const url = new URLBuilder('https://example.com')
            .addPathComponent('search')
            .addQueryParameter('genre', ['action', 'comedy'])
            .addQueryParameter('order', {chapter: 'desc'})
            .buildUrl()

        assert.equal(url, 'https://example.com/search?genre=action,comedy&order[chapter]=desc')
    })
})
