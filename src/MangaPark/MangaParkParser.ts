import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

const MP_DOMAIN = 'https://mangapark.net'

export class MangaParkParser {

    private fixImageUrl(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        if (url.startsWith('//')) return `https:${url}`
        if (url.startsWith('/')) return `${MP_DOMAIN}${url}`
        return url
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h3 a.link-hover').first().text().trim()
        if (!title) title = $('.comic-detail h3').first().text().trim()
        if (!title) title = $('title').text().split('-')[0]?.trim() ?? 'Unknown Title'

        let image = $('.w-24 img').attr('src') || $('.w-52 img').attr('src') || $('div.relative img').attr('src')
        image = this.fixImageUrl(image)

        let desc = $('.limit-html-p').text().trim()
        if (!desc) desc = $('.limit-html').text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? 'No description available'

        const authors: string[] = []
        $('a[href*="/search?word="]').each((_: any, el: any) => {
            const parentText = $(el).parent().text()
            if (parentText.includes('Story') || parentText.includes('Art')) {
                authors.push($(el).text().trim())
            }
        })
        let author = authors.length > 0 ? [...new Set(authors)].join(', ') : 'Unknown'

        let status = 'Ongoing'
        const statusText = $('span.font-bold.uppercase').text().trim().toLowerCase()
        if (statusText.includes('completed')) status = 'Completed'
        if (statusText.includes('hiatus')) status = 'Hiatus'

        const arrayTags: Tag[] = []
        $('a[href^="/search?genres="]').each((_: any, el: any) => {
            const tagText = $(el).text().trim()
            if (tagText) arrayTags.push({ id: tagText.toLowerCase(), label: tagText })
        })
        
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: '',
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // 1. Trova il contenitore principale dei capitoli
        const container = $('div[data-name="chapter-list"]')
        
        // 2. Prendi TUTTI i link dentro il contenitore (più robusto di cercare classi specifiche)
        const links = container.find('a').toArray()

        for (const el of links) {
            const link = $(el)
            const href = link.attr('href')
            
            // Filtro base: deve essere un link valido e contenere /title/
            if (!href || !href.includes('/title/')) continue

            // Estrazione ID: prendiamo l'ultima parte dell'URL
            // Es: /title/12345/9939310-chapter-128 -> "9939310-chapter-128"
            const parts = href.split('/')
            const chapterId = parts.pop()
            
            // Verifica che sia un ID capitolo valido (solitamente lungo e numerico all'inizio)
            if (!chapterId || chapterId.length < 3 || !chapterId.match(/^\d+/)) continue

            const titleRaw = link.text().trim()
            if (!titleRaw) continue

            // Cerca la data risalendo l'albero DOM
            let timeStr = ''
            let parent = link.parent()
            for(let i=0; i<5; i++) { // Risaliamo fino a 5 livelli
                const timeTag = parent.find('time')
                if (timeTag.length > 0) {
                    timeStr = timeTag.text().trim()
                    break
                }
                parent = parent.parent()
            }

            // Parsing Numeri (Volume e Capitolo)
            // Regex che cerca "Ch. 128", "Chapter 128", "c128", o numeri isolati alla fine
            const chapNumMatch = titleRaw.match(/(?:ch|chapter|episode|c)(?:\.|apters?|\s)*\s*(\d+(\.\d+)?)/i)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1] ?? '0')
            } else {
                // Fallback: cerca l'ultimo numero nel titolo
                const simpleNums = titleRaw.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1] ?? '0')
                }
            }
            
            const volMatch = titleRaw.match(/Vol\.(\d+)/i)
            const volNum = volMatch ? parseFloat(volMatch[1] ?? '0') : undefined

            // Titolo visualizzato
            let name = titleRaw
            const extraInfo = link.next('span').text().trim().replace(/^:\s*/, '')
            if (extraInfo) name += ` - ${extraInfo}`

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: this.convertTime(timeStr),
                langCode: 'en'
            }))
        }

        return chapters
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const seenIds = new Set<string>()
        const items = $('div.group.relative').toArray()

        for (const item of items) {
            const link = $('a', item).first()
            const href = link.attr('href')
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null
            
            if (!id || seenIds.has(id)) continue
            seenIds.add(id)

            let image = $('img', item).attr('src')
            image = this.fixImageUrl(image)

            let title = $('img', item).attr('title') || $('img', item).attr('alt')
            if (!title) {
                title = $(item).closest('div.flex').find('h3 a').text().trim()
            }
            if (!title) title = 'Unknown'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        }
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular Updates', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Releases', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        
        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        const gridItems = $('div.grid > div.relative.w-full.group').toArray()

        for (let i = 0; i < gridItems.length; i++) {
            const item = gridItems[i]
            const link = $('a', item).first()
            const href = link.attr('href')
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null

            if (!id || seenIds.has(id)) continue
            seenIds.add(id)

            let image = $('img', item).attr('src')
            image = this.fixImageUrl(image)
            
            let title = $('img', item).attr('title') || $('img', item).attr('alt')
            if (!title) title = $(item).find('a.link-hover').text().trim()
            if (!title) title = $(item).closest('.flex').find('h3 a').text().trim()
            if (!title) title = 'Unknown'

            const manga = App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            })

            if (i < 12) popularItems.push(manga)
            else latestItems.push(manga)
        }

        popularSection.items = popularItems
        latestSection.items = latestItems
        sectionCallback(popularSection)
        sectionCallback(latestSection)
    }

    private convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hours') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('days') || timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('years')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        if (isNaN(time.getTime())) return new Date()
        return time
    }
}