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

    // Helper per estrarre manga dalla home/grid
    private parseMangaElement($: any, item: any, type: 'grid' | 'list' | 'top'): PartialSourceManga | null {
        const el = $(item)
        
        let link, title, imageSrc, id

        if (type === 'top') {
            // Per Top Month/Week (layout lista #topMonth)
            link = el.find('h3.title a')
            title = link.text().trim()
            imageSrc = el.find('.thumb img').attr('data-original') || el.find('.thumb img').attr('src')
        } else if (type === 'grid') {
            // Per Trending (owl-carousel .item)
            link = el.find('a').first()
            title = el.find('.slide-caption h3 a').text().trim()
            if (!title) title = link.attr('title')
            // Trending usa lazyOwl
            imageSrc = el.find('img').attr('src') || el.find('img').attr('data-src')
        } else {
            // Per Latest (Layout .items .row .item)
            link = el.find('figure .image a').first()
            if (!link.length) link = el.find('h3 a').first()
            
            title = el.find('figcaption h3 a').text().trim()
            if (!title) title = link.attr('title')
            
            // Latest usa data-original
            imageSrc = el.find('img').attr('data-original') || el.find('img').attr('src')
        }

        if (!link || !title) return null
        
        const href = link.attr('href')
        id = href?.split('/').filter((p: string) => p && p !== 'comic' && p !== 'xoxocomic.com').pop()

        if (!id) return null

        const image = this.getImageSrc(imageSrc)
        
        // Sottotitolo (es. Issue #1)
        let subtitle = el.find('.chapter a, .slide-caption a').last().text().trim()
        if (!subtitle || subtitle === title) subtitle = ''

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    // Usato da XoxoComic.ts per la Home Page (Trending, Top Month, Top Week)
    parseHomeSections($: any, trending: HomeSection, topMonth: HomeSection, topWeek: HomeSection): void {
        
        // 1. Trending (#ctl00_divAlt1 .items-slide .item)
        const trendingItems: PartialSourceManga[] = []
        // Selettore ampio per prendere sia carousel inizializzato che raw
        $('.items-slide .item').each((_: any, item: any) => {
            // Esclude i duplicati creati da OwlCarousel (.cloned)
            if ($(item).closest('.cloned').length > 0) return
            
            const manga = this.parseMangaElement($, item, 'grid')
            if (manga) trendingItems.push(manga)
        })
        trending.items = trendingItems

        // 2. Top Month (#topMonth li)
        const monthItems: PartialSourceManga[] = []
        $('#topMonth li').each((_: any, item: any) => {
            const manga = this.parseMangaElement($, item, 'top')
            if (manga) monthItems.push(manga)
        })
        topMonth.items = monthItems

        // 3. Top Week (#topWeek li)
        const weekItems: PartialSourceManga[] = []
        $('#topWeek li').each((_: any, item: any) => {
            const manga = this.parseMangaElement($, item, 'top')
            if (manga) weekItems.push(manga)
        })
        topWeek.items = weekItems
    }

    // Usato per Latest Updates (dalla pagina /new-comic)
    parseLatestSection($: any, latest: HomeSection): void {
        const latestItems: PartialSourceManga[] = []
        
        $('.items .row .item').each((_: any, item: any) => {
            const manga = this.parseMangaElement($, item, 'list')
            if (manga) latestItems.push(manga)
        })
        
        latest.items = latestItems
    }

    // Usato per Search e View More (Latest)
    parseGridItems($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('.items .row .item').each((_: any, item: any) => {
            const manga = this.parseMangaElement($, item, 'list')
            if (manga) results.push(manga)
        })

        return results
    }

    // --- LE ALTRE FUNZIONI (Dettagli, Capitoli) RIMANGONO INVARIATE ---
    // Mantengo il tuo codice funzionante per queste parti

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('.title-detail').text().trim() || $('h1').first().text().trim()
        const image = this.getImageSrc($('.col-image img').attr('src'))
        let desc = $('.detail-content p').first().text().trim() || 'No description'
        let author = 'Unknown', status = 'Ongoing'

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
        const tagSections = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

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

    getChapterPageCount($: any): number {
        let maxPage = 1
        $('.pagination li a').each((_: any, el: any) => {
            const match = $(el).attr('href')?.match(/page=(\d+)/)
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
        while ((match = imgRegex.exec(html)) !== null) if (match[1]) pages.push(this.getImageSrc(match[1]))
        
        if (pages.length === 0) {
            const genericRegex = /<img[^>]+src=["']([^"']+)["']/g
            while ((match = genericRegex.exec(html)) !== null) {
                const url = match[1]
                if (url && !url.startsWith('data:') && !url.includes('loading') && !url.includes('logo')) pages.push(this.getImageSrc(url))
            }
        }
        return App.createChapterDetails({ id: chapterId, mangaId: mangaId, pages: pages })
    }
}