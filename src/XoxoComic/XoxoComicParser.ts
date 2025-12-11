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

    private getImageSrc(url: string | undefined): string {
        if (!url || url.includes('logo') || url.includes('placeholder')) return 'https://paperback.moe/icons/logo-alt.svg'
        if (url.startsWith('data:')) return 'https://paperback.moe/icons/logo-alt.svg'
        
        url = url.trim()
        if (url.startsWith('//')) {
            url = `https:${url}`
        } else if (url.startsWith('/')) {
            url = BASE_URL + url
        }
        
        return url
    }

    // Usato per Home (Trending) e Search
    private parseMangaItem($: any, element: any): PartialSourceManga | null {
        const item = $(element)
        let link = item.find('a').first()
        if (!link.attr('href')) link = item.find('h3 a').first()

        const href = link.attr('href')
        const id = href?.split('/').filter((p: string) => p && p !== 'comic' && p !== 'xoxocomic.com').pop()

        if (!id) return null

        let title = item.find('h3').text().trim()
        if (!title) title = link.attr('title') || link.text().trim()
        if (!title) title = 'Unknown Title'

        let img = item.find('img').first()
        let imageSrc = img.attr('data-original') || img.attr('data-src') || img.attr('src')
        
        if (!imageSrc || imageSrc.startsWith('data:')) {
            const style = item.find('.div-poster, .image').attr('style')
            const match = style?.match(/url\(['"]?(.*?)['"]?\)/)
            if (match) imageSrc = match[1]
        }

        const image = this.getImageSrc(imageSrc)
        const subtitle = item.find('.chapter a').first().text().trim()

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('.title-detail').text().trim()
        if (!title) title = $('h1').first().text().trim()
        
        const imageSrc = $('.col-image img').attr('src')
        const image = this.getImageSrc(imageSrc)

        let desc = $('.detail-content p').first().text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? 'No description'

        let author = 'Unknown'
        let status = 'Ongoing'

        $('.list-info li').each((_: any, row: any) => {
            const label = $(row).find('.name').text().toLowerCase()
            const value = $(row).find('.col-xs-8').text().trim()

            if (label.includes('author')) author = value
            if (label.includes('status')) {
                if (value.toLowerCase().includes('completed')) status = 'Completed'
            }
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

    // FIX PAGINAZIONE: Più robusto, guarda anche il testo del link
    getChapterPageCount($: any): number {
        let maxPage = 1
        
        $('.pagination li a').each((_: any, el: any) => {
            const href = $(el).attr('href')
            const text = $(el).text().trim()
            
            // Prova a estrarre dal testo (es. "3", "4")
            const textNum = parseInt(text)
            if (!isNaN(textNum)) {
                if (textNum > maxPage) maxPage = textNum
            } else if (href) {
                // Prova a estrarre dall'URL
                const match = href.match(/page=(\d+)/)
                if (match) {
                    const num = parseInt(match[1])
                    if (num > maxPage) maxPage = num
                }
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

            // SMART CLEANING (Come richiesto)
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
                
                // Formattazione richiesta: Vol. Deluxe X Part. Y
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
        
        const imgRegex = /<img[^>]+data-original=["']([^"']+)["']/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            const url = match[1]
            if (url) pages.push(this.getImageSrc(url))
        }

        if (pages.length === 0) {
            const genericRegex = /<img[^>]+src=["']([^"']+)["']/g
            while ((match = genericRegex.exec(html)) !== null) {
                const url = match[1]
                if (url && !url.startsWith('data:') && !url.includes('loading') && !url.includes('logo')) {
                    pages.push(this.getImageSrc(url))
                }
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseGridItems($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        $('.item, .list-truyen-item-wrap, .search-story-item').each((_: any, item: any) => {
            const manga = this.parseMangaItem($, item)
            if (manga && !seenIds.has(manga.mangaId)) {
                seenIds.add(manga.mangaId)
                results.push(manga)
            }
        })

        return results
    }

    // --- SEZIONI HOME PAGE ---

    parseHomeSections($: any, trending: HomeSection, topMonth: HomeSection, topWeek: HomeSection): void {
        const trendingItems: PartialSourceManga[] = []
        
        $('.items-slide .item').each((_: any, item: any) => {
            if ($(item).closest('.cloned').length > 0) return
            
            const el = $(item)
            const link = el.find('a').first()
            const id = link.attr('href')?.split('/').pop()
            const title = el.find('.slide-caption h3 a').text().trim() || link.attr('title')
            
            let imageSrc = el.find('img').attr('src') || el.find('img').attr('data-src')
            const image = this.getImageSrc(imageSrc)
            
            if (id && title) {
                trendingItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: 'Trending'
                }))
            }
        })
        trending.items = trendingItems

        // Helper per le liste top
        const parseTop = (selector: string) => {
            const items: PartialSourceManga[] = []
            $(selector + ' li').each((_: any, item: any) => {
                const link = $(item).find('h3.title a')
                const id = link.attr('href')?.split('/').pop()
                const title = link.text().trim()
                let imageSrc = $(item).find('.thumb img').attr('data-original') || $(item).find('.thumb img').attr('src')
                const image = this.getImageSrc(imageSrc)
                const chapter = $(item).find('p.chapter a').text().trim()

                if (id && title) {
                    items.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image,
                        title: title,
                        subtitle: chapter
                    }))
                }
            })
            return items
        }

        topMonth.items = parseTop('#topMonth')
        topWeek.items = parseTop('#topWeek')
    }

    // NUOVO PARSER SPECIFICO PER /NEW-COMIC
    // Questo risolve il problema di Latest Updates vuoto
    parseLatestItems($: any): PartialSourceManga[] {
        const items: PartialSourceManga[] = []
        
        // Selettore basato sul file Latest Updates.txt
        $('.items .row .item').each((_: any, item: any) => {
            const el = $(item)
            
            // Il titolo è nel link dell'immagine
            const imgLink = el.find('figure .image a').first()
            const title = imgLink.attr('title')?.replace(' Comic', '')?.replace('Read ', '')?.replace(' online', '')?.trim()
            
            const href = imgLink.attr('href')
            const id = href?.split('/').filter((p: string) => p && p !== 'comic').pop()
            
            // Immagine
            const img = el.find('figure .image img')
            const imageSrc = img.attr('src') || img.attr('data-original')
            const image = this.getImageSrc(imageSrc)
            
            // Sottotitolo (es. Released: 2025)
            // Non ci sono capitoli in questa vista, usiamo l'anno o lo stato
            const released = el.find('.message_main p:contains("Released:")').text().replace('Released:', '').trim()
            const subtitle = released ? `Released: ${released}` : undefined

            if (id && title) {
                items.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        
        return items
    }
}