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

const BASE_URL = 'https://xoxocomic.com'

export class XoxoComicParser {

    // --- UTILITY ---

    private decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(dec))
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&#039;/g, "'")
                  .replace(/&apos;/g, "'")
                  .replace(/&nbsp;/g, ' ')
    }

    private cleanTitle(title: string): string {
        if (!title) return 'Unknown'
        let clean = this.decodeHTMLEntity(title)
        
        // Pulizia aggressiva dei suffissi SEO
        clean = clean.replace(/ - Read Full List of Chapters \| Xoxocomic/gi, '')
                     .replace(/ Read Full List of Chapters/gi, '')
                     .replace(/ \| Xoxocomic/gi, '')
                     .replace(/ Comic$/i, '')
                     .replace(/^Read /i, '')
                     .replace(/ online$/i, '')
                     .trim()
        return clean
    }

    private getImageSrc(url: string | undefined): string {
        if (!url || url.includes('logo') || url.includes('placeholder')) return 'https://paperback.moe/icons/logo-alt.svg'
        if (url.startsWith('data:')) return 'https://paperback.moe/icons/logo-alt.svg'
        
        url = url.trim()
        if (url.startsWith('//')) return `https:${url}`
        if (url.startsWith('/')) return BASE_URL + url
        return url
    }

    // --- HOME PAGE PARSERS ---

    parseTrendingItems($: any): PartialSourceManga[] {
        const items: PartialSourceManga[] = []
        // Selettore per OwlCarousel (Trending)
        $('.items-slide .item').each((_: any, item: any) => {
            // Ignora elementi duplicati dal carosello
            if ($(item).closest('.cloned').length > 0) return

            const link = $(item).find('a').first()
            const id = link.attr('href')?.split('/').pop()
            
            // Titolo nel caption
            let rawTitle = $(item).find('.slide-caption h3 a').text().trim() 
            if (!rawTitle) rawTitle = link.attr('title') ?? 'Unknown'
            
            // Immagine: OwlCarousel usa spesso classi lazyOwl e data-src
            let imageSrc = $(item).find('img').attr('data-src') || $(item).find('img').attr('src')
            // Se ancora null, cerca nella classe lazyOwl
            if (!imageSrc) imageSrc = $(item).find('.lazyOwl').attr('data-src')

            if (id) {
                items.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: this.getImageSrc(imageSrc),
                    title: this.cleanTitle(rawTitle),
                    subtitle: 'Trending'
                }))
            }
        })
        return items
    }

    parseLatestItems($: any): PartialSourceManga[] {
        const items: PartialSourceManga[] = []
        // Selettore per layout /new-comic
        $('.items .row .item').each((_: any, item: any) => {
            const el = $(item)
            const imgLink = el.find('.image a').first()
            
            let rawTitle = imgLink.attr('title')
            // Fallback titolo
            if (!rawTitle) rawTitle = el.find('.message_main label:contains("Alternate Name:")').parent().text().replace('Alternate Name:', '')
            
            const href = imgLink.attr('href')
            const id = href?.split('/').filter((p: string) => p && p !== 'comic').pop()
            
            // Immagine: data-original (come visto nel file txt)
            const imageSrc = el.find('img').attr('data-original') || el.find('img').attr('src')
            
            // Sottotitolo
            const released = el.find('.message_main p:contains("Released:")').text().replace('Released:', '').trim()
            const subtitle = released ? `Released: ${released}` : undefined

            if (id) {
                items.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: this.getImageSrc(imageSrc),
                    title: this.cleanTitle(rawTitle || 'Unknown'),
                    subtitle: subtitle
                }))
            }
        })
        return items
    }

    parseTopSectionItems($: any, selector: string): PartialSourceManga[] {
        const items: PartialSourceManga[] = []
        $(selector + ' li').each((_: any, item: any) => {
            const link = $(item).find('h3.title a')
            const id = link.attr('href')?.split('/').pop()
            const rawTitle = link.text().trim()
            
            let imageSrc = $(item).find('img').attr('data-original') || $(item).find('img').attr('src')
            const chapter = $(item).find('p.chapter a').text().trim()

            if (id) {
                items.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: this.getImageSrc(imageSrc),
                    title: this.cleanTitle(rawTitle),
                    subtitle: chapter
                }))
            }
        })
        return items
    }

    parseGridItems($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        $('.item, .list-truyen-item-wrap, .search-story-item').each((_: any, item: any) => {
            const el = $(item)
            let link = el.find('a').first()
            if (!link.attr('href')) link = el.find('h3 a').first()

            const href = link.attr('href')
            const id = href?.split('/').filter((p: string) => p && p !== 'comic').pop()

            if (!id || seenIds.has(id)) return

            let rawTitle = el.find('h3').text().trim() || link.attr('title') || 'Unknown'
            let imageSrc = el.find('img').attr('data-original') || el.find('img').attr('src')
            
            seenIds.add(id)
            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: this.getImageSrc(imageSrc),
                title: this.cleanTitle(rawTitle),
                subtitle: el.find('.chapter a').first().text().trim()
            }))
        })
        return results
    }

    // --- DETTAGLI ---

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let rawTitle = $('.title-detail').text().trim()
        if (!rawTitle) rawTitle = $('h1').first().text().trim()
        if (!rawTitle) rawTitle = $('title').text().trim()
        
        const title = this.cleanTitle(rawTitle)
        const image = this.getImageSrc($('.col-image img').attr('src'))
        let desc = $('.detail-content p').first().text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? 'No description'
        desc = this.decodeHTMLEntity(desc)

        let author = 'Unknown'
        let status = 'Ongoing'

        $('.list-info li').each((_: any, row: any) => {
            const label = $(row).find('.name').text().toLowerCase()
            const value = $(row).find('.col-xs-8').text().trim()
            if (label.includes('author')) author = value
            if (label.includes('status') && value.toLowerCase().includes('completed')) status = 'Completed'
        })

        const arrayTags: Tag[] = []
        $('.list-info .kind a').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('/').pop() ?? label
            if (label) arrayTags.push(App.createTag({ id, label }))
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc
            })
        })
    }

    // --- LOGICA CAPITOLI E PAGINAZIONE (FIX SPAWN) ---

    getChapterPageCount($: any): number {
        let maxPage = 1
        // Scansiona tutti i link di paginazione
        $('.pagination li a').each((_: any, el: any) => {
            const href = $(el).attr('href')
            // Cerca "page=X" nell'URL
            const match = href?.match(/[?&]page=(\d+)/)
            if (match) {
                const num = parseInt(match[1])
                if (num > maxPage) maxPage = num
            }
        })
        return maxPage
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('.list-chapter li.row:not(.heading)').each((_: any, li: any) => {
            const link = $(li).find('a').first()
            const rawTitle = link.text().trim()
            const href = link.attr('href')
            if (!href) return

            let chapterId = href.replace(BASE_URL, '')
            if (chapterId.startsWith('/')) chapterId = chapterId.substring(1)

            const dateText = $(li).find('.col-xs-3').text().trim()
            let time = new Date()
            if (dateText && !dateText.includes('Day')) {
                const parsed = new Date(dateText)
                if (!isNaN(parsed.getTime())) time = parsed
            }

            // --- SMART NAMING ---
            let cleanName = rawTitle.replace(/^.*?\(\d{4}\)\s*/, '').trim()
            const looseMangaName = mangaId.replace(/-/g, ' ')
            if (cleanName === rawTitle && rawTitle.toLowerCase().includes(looseMangaName)) {
                 cleanName = rawTitle.replace(new RegExp(looseMangaName, 'gi'), '').trim()
            }
            cleanName = cleanName.replace(/^_+|_+$/g, '')

            let name = cleanName
            let chapNum = 0
            
            const multiPartMatch = cleanName.match(/_?([a-zA-Z_\s]+)[\s_](\d+)[\s_]?\(?Part[\s_](\d+)\)?/i)
            const specialMatch = cleanName.match(/_?([a-zA-Z_\s]+)[\s_](\d+)/i)

            if (multiPartMatch && (cleanName.toLowerCase().includes('part') || cleanName.toLowerCase().includes('edition'))) {
                let type = multiPartMatch[1]?.replace(/_/g, ' ').trim() ?? 'Vol'
                const volNum = parseInt(multiPartMatch[2] ?? '0')
                const partNum = parseFloat(multiPartMatch[3] ?? '0')
                // "Vol. Deluxe 1 Part. 1"
                name = `Vol. ${type} ${volNum} Part. ${partNum}`
                chapNum = partNum
            } 
            else if (specialMatch && !cleanName.toLowerCase().includes('issue') && !cleanName.toLowerCase().includes('chapter')) {
                let type = specialMatch[1]?.replace(/_/g, ' ').trim()
                const num = parseFloat(specialMatch[2] ?? '0')
                name = `Vol. ${type} ${num}`
                chapNum = num
            }
            else {
                const issueMatch = cleanName.match(/(?:Issue|Chapter|^)\s*#?(\d+(\.\d+)?)/i)
                if (issueMatch) {
                    chapNum = parseFloat(issueMatch[1] ?? '0')
                    name = `Ch. ${chapNum}`
                } else {
                    const fallbackNum = cleanName.match(/(\d+(\.\d+)?)/g)
                    if (fallbackNum) {
                        chapNum = parseFloat(fallbackNum[fallbackNum.length - 1] ?? '0')
                    }
                    name = cleanName.replace(/_/g, ' ').trim()
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: undefined, 
                time: time,
                langCode: 'en'
            }))
        })
        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        // Script JS
        const scriptMatch = html.match(/var\s+lstImages\s*=\s*new\s+Array\((.*?)\);/)
        if (scriptMatch && scriptMatch[1]) {
            const urls = scriptMatch[1].split(',').map((u: string) => u.trim().replace(/['"]/g, ''))
            for (const url of urls) {
                const clean = this.getImageSrc(url)
                if (clean && !clean.includes('logo-alt')) pages.push(clean)
            }
        }
        // Fallback Data-Original
        if (pages.length === 0) {
            const imgRegex = /<img[^>]+data-original=["']([^"']+)["']/g
            let match
            while ((match = imgRegex.exec(html)) !== null) {
                const url = this.getImageSrc(match[1])
                if (url && !url.includes('logo-alt')) pages.push(url)
            }
        }
        // Fallback Src (filtrato)
        if (pages.length === 0) {
            const genericRegex = /<img[^>]+src=["']([^"']+)["']/g
            let match
            while ((match = genericRegex.exec(html)) !== null) {
                const url = this.getImageSrc(match[1])
                if (url && !url.includes('logo-alt')) pages.push(url)
            }
        }
        return App.createChapterDetails({ id: chapterId, mangaId: mangaId, pages: pages })
    }
}