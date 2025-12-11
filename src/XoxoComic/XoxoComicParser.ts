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
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        // FIX: Rifiuta stringhe base64 (placeholder)
        if (url.startsWith('data:')) return 'https://paperback.moe/icons/logo-alt.svg'
        if (url.includes('logo') || url.includes('placeholder')) return 'https://paperback.moe/icons/logo-alt.svg'

        url = url.trim()
        if (url.startsWith('//')) {
            url = `https:${url}`
        } else if (url.startsWith('/')) {
            url = BASE_URL + url
        }
        
        return url
    }

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
        // Cerca data-original PRIMA di src per evitare il base64
        let imageSrc = img.attr('data-original') || img.attr('data-src') || img.attr('src')
        
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
        
        // Dettaglio: immagine cover
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

    getChapterPageCount($: any): number {
        let maxPage = 1
        $('.pagination li a').each((_: any, el: any) => {
            const href = $(el).attr('href')
            const match = href?.match(/page=(\d+)/)
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

            // --- SMART CLEANING ---
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
        
        // 1. Estrazione Array JS (se presente)
        const scriptMatch = html.match(/var\s+lstImages\s*=\s*new\s+Array\((.*?)\);/)
        if (scriptMatch && scriptMatch[1]) {
            const urls = scriptMatch[1].split(',').map((u: string) => u.trim().replace(/['"]/g, ''))
            for (const url of urls) {
                const clean = this.getImageSrc(url)
                if (clean && !clean.includes('logo-alt')) pages.push(clean)
            }
        } 
        
        // 2. Fallback: regex data-original
        if (pages.length === 0) {
            const imgRegex = /<img[^>]+data-original=["']([^"']+)["']/g
            let match
            while ((match = imgRegex.exec(html)) !== null) {
                const url = match[1]
                const clean = this.getImageSrc(url)
                if (clean && !clean.includes('logo-alt')) pages.push(clean)
            }
        }

        // 3. Ultimo Fallback: regex src (ma filtra data:)
        if (pages.length === 0) {
            const genericRegex = /<img[^>]+src=["']([^"']+)["']/g
            let match
            while ((match = genericRegex.exec(html)) !== null) {
                const url = match[1]
                const clean = this.getImageSrc(url)
                if (clean && !clean.includes('logo-alt')) pages.push(clean)
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

        // Selettore universale
        $('.item, .list-truyen-item-wrap, .search-story-item').each((_: any, item: any) => {
            const manga = this.parseMangaItem($, item)
            if (manga && !seenIds.has(manga.mangaId)) {
                seenIds.add(manga.mangaId)
                results.push(manga)
            }
        })

        return results
    }

    parseHomeSections($: any, trending: HomeSection, topMonth: HomeSection, topWeek: HomeSection): void {
        
        // 1. TRENDING (Dalla Home)
        const trendingItems: PartialSourceManga[] = []
        // Selettore basato su "Trending Comics.txt"
        $('.items-slide .item').each((_: any, item: any) => {
            // Ignora cloni owl
            if ($(item).parent('.cloned').length > 0) return

            const manga = this.parseMangaItem($, item)
            if (manga) trendingItems.push(manga)
        })
        trending.items = trendingItems

        // 2. TOP MONTH (Dalla Home)
        const monthItems: PartialSourceManga[] = []
        $('#topMonth li').each((_: any, item: any) => {
            const link = $(item).find('h3.title a')
            const id = link.attr('href')?.split('/').pop()
            const title = link.text().trim()
            
            // Su Top Month usano data-original
            let imageSrc = $(item).find('img').attr('data-original') || $(item).find('img').attr('src')
            const image = this.getImageSrc(imageSrc)
            const chapter = $(item).find('p.chapter a').text().trim()

            if (id && title) {
                monthItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }))
            }
        })
        topMonth.items = monthItems

        // 3. TOP WEEK (Dalla Home)
        const weekItems: PartialSourceManga[] = []
        $('#topWeek li').each((_: any, item: any) => {
            const link = $(item).find('h3.title a')
            const id = link.attr('href')?.split('/').pop()
            const title = link.text().trim()
            
            let imageSrc = $(item).find('img').attr('data-original') || $(item).find('img').attr('src')
            const image = this.getImageSrc(imageSrc)
            const chapter = $(item).find('p.chapter a').text().trim()

            if (id && title) {
                weekItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }))
            }
        })
        topWeek.items = weekItems
    }
}