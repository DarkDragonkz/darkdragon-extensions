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

    /**
     * Tenta di ottenere l'immagine alla massima risoluzione rimuovendo suffissi di resize.
     */
    private getHighResImage(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        
        if (url.startsWith('//')) url = `https:${url}`
        else if (url.startsWith('/')) url = `${MP_DOMAIN}${url}`

        return url.replace(/_(?:res_)?\d+x\d+(?:\.[a-z]+)?$/i, '')
    }

    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        let src = img.attr('data-src') || img.attr('srcset') || img.attr('src')
        return this.getHighResImage(src)
    }

    private parseMangaItem($: any, element: any): PartialSourceManga | null {
        const item = $(element)
        let link = item.is('a') ? item : item.find('a[href*="/title/"]').first()
        const href = link.attr('href')
        const idMatch = href?.match(/\/title\/(\d+)/)
        const id = idMatch ? idMatch[1] : null

        if (!id) return null

        const image = this.getImageSrc(item)

        let title = item.find('h3 a, a.font-bold').first().text().trim()
        if (!title) title = item.find('img').attr('title') || item.find('img').attr('alt') || ''
        if (!title) title = link.text().trim()
        if (!title) title = 'Unknown Title'

        let subtitle = item.find('div.flex.justify-between a, .absolute.bottom-0').first().text().trim()

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h3 a.link-hover').first().text().trim()
        if (!title) title = $('.comic-detail h3').first().text().trim()
        if (!title) title = $('title').text().split('-')[0]?.trim() ?? 'Unknown Title'

        let image = this.getImageSrc($('.w-24, .w-52, div.relative').first())

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
        const links = $('div[data-name="chapter-list"] a, .p-2 a.flex').toArray()

        for (const el of links) {
            const link = $(el)
            const href = link.attr('href')
            
            if (!href || !href.includes('/title/')) continue

            const parts = href.split('/')
            const chapterId = parts.pop() || parts[parts.length - 1]
            if (!chapterId) continue

            const titleRaw = link.text().trim()
            if (!titleRaw) continue

            let timeStr = ''
            let parent = link.parent()
            const timeTag = parent.find('time').first() || parent.parent().find('time').first()
            if (timeTag.length > 0) timeStr = timeTag.text().trim()

            const volMatch = titleRaw.match(/Vol\.?\s*(\d+(\.\d+)?)/i)
            const volNum = volMatch ? parseFloat(volMatch[1]) : undefined

            let chapNum = 0
            const chapMatch = titleRaw.match(/(?:ch|chapter|c|episode)\.?\s*(\d+(\.\d+)?)/i)
            if (chapMatch) {
                chapNum = parseFloat(chapMatch[1])
            } else {
                const simpleNums = titleRaw.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1])
                }
            }

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

    // --- NUOVO: Parsing avanzato delle pagine ---
    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        // 1. TENTATIVO DOM: Selettori standard
        $('div[data-name="image-item"] img, .comic-image img').each((_: any, el: any) => {
            const img = $(el)
            let src = img.attr('src')
            if (!src || src.startsWith('data:') || src.includes('loading')) {
                src = img.attr('data-src') || img.attr('srcset')
            }
            if (src && src.startsWith('http')) {
                pages.push(src)
            }
        })

        // 2. TENTATIVO JSON/SCRIPT: Se il DOM è vuoto, cerca nei tag script
        if (pages.length === 0) {
            const scripts = $('script').toArray()
            for (const script of scripts) {
                const content = $(script).html()
                if (!content) continue

                // Cerca array di oggetti JSON che contengono url immagini
                // Esempio pattern: "u": "https://..." o "src": "https://..."
                // Regex generica per estrarre URL http/https all'interno di stringhe JSON
                const urlMatches = content.match(/https?:\/\/[^"'\s\\]+\.(?:jpg|jpeg|png|webp)/gi)
                
                if (urlMatches && urlMatches.length > 0) {
                    for (const url of urlMatches) {
                        // Filtri base per evitare url spazzatura (ads, tracking)
                        if (!url.includes('google') && !url.includes('facebook') && !url.includes('analytics')) {
                            // Rimuoviamo backslashes di escape JSON se presenti
                            const cleanUrl = url.replace(/\\/g, '')
                            if (!pages.includes(cleanUrl)) {
                                pages.push(cleanUrl)
                            }
                        }
                    }
                }
            }
        }

        if (pages.length === 0) {
            throw new Error(`No pages found for chapter ${chapterId}. Possible Cloudflare or Login issue.`)
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const seenIds = new Set<string>()
        const selector = 'div.group.relative, div.flex.border-b'
        
        $(selector).each((_: any, element: any) => {
            const item = this.parseMangaItem($, element)
            if (item && !seenIds.has(item.mangaId)) {
                seenIds.add(item.mangaId)
                results.push(item)
            }
        })
        
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Popular Updates 🔥', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowLarge 
        })
        
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Releases 🆕', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })
        
        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        const popularContainer = $('b:contains("Popular Updates")').closest('div.space-y-5')
        popularContainer.find('div.group.relative').each((_: any, el: any) => {
            const item = this.parseMangaItem($, el)
            if (item && !seenIds.has(item.mangaId)) {
                seenIds.add(item.mangaId)
                popularItems.push(item)
            }
        })
        popularSection.items = popularItems
        sectionCallback(popularSection)

        const latestContainer = $('b:contains("Latest Releases")').closest('div.space-y-5')
        latestContainer.find('div.flex.border-b').each((_: any, el: any) => {
            const item = this.parseMangaItem($, el)
            if (item && !seenIds.has(item.mangaId)) {
                seenIds.add(item.mangaId)
                latestItems.push(item)
            }
        })
        latestSection.items = latestItems
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