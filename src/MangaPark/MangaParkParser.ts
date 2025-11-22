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

    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        let src = img.attr('src') || img.attr('data-src') || img.attr('srcset')
        return this.fixImageUrl(src)
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h3 a.link-hover').first().text().trim()
        if (!title) title = $('.comic-detail h3').first().text().trim()
        if (!title) title = $('title').text().split('-')[0]?.trim() ?? 'Unknown Title'

        let image = this.getImageSrc($('.w-24, .w-52, div.relative'))

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
        const container = $('div[data-name="chapter-list"]')
        const links = container.find('a').toArray()

        for (const el of links) {
            const link = $(el)
            const href = link.attr('href')
            
            if (!href || !href.includes('/title/')) continue

            const parts = href.split('/')
            const chapterId = parts.pop()
            
            if (!chapterId || chapterId.length < 3 || !chapterId.match(/^\d+/)) continue

            const titleRaw = link.text().trim()
            if (!titleRaw) continue

            let timeStr = ''
            let parent = link.parent()
            for(let i=0; i<5; i++) {
                const timeTag = parent.find('time')
                if (timeTag.length > 0) {
                    timeStr = timeTag.text().trim()
                    break
                }
                parent = parent.parent()
            }

            const chapNumMatch = titleRaw.match(/(?:ch|chapter|episode|c)(?:\.|apters?|\s)*\s*(\d+(\.\d+)?)/i)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1] ?? '0')
            } else {
                const simpleNums = titleRaw.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1] ?? '0')
                }
            }
            
            const volMatch = titleRaw.match(/Vol\.(\d+)/i)
            const volNum = volMatch ? parseFloat(volMatch[1] ?? '0') : undefined

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

        // 1. Cerca Layout GRIGLIA (Search / Popular)
        let items = $('div.group.relative').toArray()
        
        // 2. Se non trova griglia, Cerca Layout LISTA (Latest)
        // La pagina /latest usa div.flex.border-b
        if (items.length === 0) {
            items = $('div.flex.border-b').toArray()
        }

        for (const item of items) {
            // Tenta di trovare il link in modi diversi a seconda del layout
            let link = $(item).is('a') ? $(item) : $('a', item).first()
            // Nel layout lista, il primo link è spesso l'immagine, il secondo il titolo
            // Cerchiamo specificamente link che contengono /title/
            if (!link.attr('href')?.includes('/title/')) {
                 link = $('a[href*="/title/"]', item).first()
            }

            const href = link.attr('href')
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null
            
            if (!id || seenIds.has(id)) continue
            seenIds.add(id)

            const image = this.getImageSrc($(item))

            let title = ''
            // Titolo da attributo immagine
            title = $('img', item).attr('title') || $('img', item).attr('alt') || ''
            
            // Titolo da link testo
            if (!title) {
                 // Cerca link con classe font-bold o link-hover
                 title = $(item).find('a.font-bold').text().trim()
                 if(!title) title = $(item).find('h3 a').text().trim()
                 if(!title) title = link.text().trim()
            }
            
            if (!title) title = 'Unknown'

            // Sottotitolo (es. Ultimo capitolo)
            const subtitle = $(item).find('div.flex.justify-between a').first().text().trim()

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: subtitle || undefined
            }))
        }
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        // FIX: Abilitato containsMoreItems: true
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular Updates', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Releases', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        
        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // --- POPULAR (Griglia) ---
        const popularGrid = $('b:contains("Popular Updates")').closest('div.space-y-5').find('div.grid div.relative.group').toArray()
        
        for (const item of popularGrid) {
            const el = $(item)
            const link = el.find('a').first()
            const href = link.attr('href')
            const id = href?.match(/\/title\/(\d+)/)?.[1]

            if (id && !seenIds.has(id)) {
                seenIds.add(id)
                const image = this.getImageSrc(el)
                let title = el.find('.bg-black\\/60 a.font-bold').text().trim()
                if (!title) title = el.find('img').attr('title') || el.find('img').attr('alt') || 'Unknown'

                popularItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: 'Popular'
                }))
            }
        }
        popularSection.items = popularItems
        sectionCallback(popularSection)

        // --- LATEST (Lista) ---
        const latestContainer = $('b:contains("Latest Releases")').closest('div.space-y-5')
        const latestList = latestContainer.find('div.grid > div.flex.border-b').toArray()

        for (const item of latestList) {
            const el = $(item)
            const titleLink = el.find('h3 a').first()
            const href = titleLink.attr('href')
            const id = href?.match(/\/title\/(\d+)/)?.[1]

            if (id && !seenIds.has(id)) {
                seenIds.add(id)
                const image = this.getImageSrc(el)
                const title = titleLink.text().trim() || 'Unknown'
                const subtitle = el.find('div.flex.justify-between a').first().text().trim()

                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        }
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