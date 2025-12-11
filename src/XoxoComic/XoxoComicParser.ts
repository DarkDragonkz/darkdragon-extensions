import {
    Chapter,
    ChapterDetails,
    HomeSection,
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
        return this.decodeHTMLEntity(title)
            .replace(/ - Read Full List of Chapters \| Xoxocomic/gi, '')
            .replace(/ Read Full List of Chapters/gi, '')
            .replace(/ \| Xoxocomic/gi, '')
            .replace(/ Comic$/i, '')
            .replace(/^Read /i, '')
            .replace(/ online$/i, '')
            .trim()
    }

    private getImageSrc(url: string | undefined): string {
        if (!url || url.includes('logo') || url.includes('placeholder')) return 'https://paperback.moe/icons/logo-alt.svg'
        if (url.startsWith('data:')) return 'https://paperback.moe/icons/logo-alt.svg'
        
        url = url.trim()
        if (url.startsWith('//')) return `https:${url}`
        if (url.startsWith('/')) return BASE_URL + url
        return url
    }

    // --- PARSER UNIFICATO PER ITEM ---
    // Questa funzione sostituisce parseTrendingItems, parseLatestItems, parseTopSectionItems e parseGridItems
    parseUniversalItem($: any, element: any, context: 'grid' | 'list' | 'slide' | 'top'): PartialSourceManga | null {
        const item = $(element)
        let link, title, imageSrc, id, subtitle

        switch (context) {
            case 'slide': // Trending
                if (item.closest('.cloned').length > 0) return null
                link = item.find('a').first()
                title = item.find('.slide-caption h3 a').text().trim() || link.attr('title')
                imageSrc = item.find('img').attr('data-src') || item.find('img').attr('src')
                subtitle = 'Trending'
                break

            case 'top': // Top Month/Week
                link = item.find('h3.title a')
                title = link.text().trim()
                imageSrc = item.find('img').attr('data-original') || item.find('img').attr('src')
                subtitle = item.find('p.chapter a').text().trim()
                break

            case 'list': // Latest Updates (/new-comic)
                link = item.find('.image a').first()
                title = link.attr('title') || item.find('.message_main label:contains("Alternate Name:")').parent().text().replace('Alternate Name:', '')
                imageSrc = item.find('img').attr('data-original') || item.find('img').attr('src')
                
                // UI: Mostra anno o stato come sottotitolo
                const released = item.find('.message_main p:contains("Released:")').text().replace('Released:', '').trim()
                const status = item.find('.message_main p:contains("Status:")').text().replace('Status:', '').trim()
                subtitle = released ? `Released: ${released}` : status
                break

            case 'grid': // Search / Generic
            default:
                link = item.find('a').first()
                if (!link.attr('href')) link = item.find('h3 a').first()
                title = item.find('h3').text().trim() || link.attr('title')
                imageSrc = item.find('img').attr('data-original') || item.find('img').attr('src')
                subtitle = item.find('.chapter a').first().text().trim()
                break
        }

        if (!link || !link.attr('href')) return null
        
        const href = link.attr('href')
        id = href?.split('/').filter((p: string) => p && p !== 'comic' && p !== 'xoxocomic.com').pop()
        
        if (!id) return null

        return App.createPartialSourceManga({
            mangaId: id,
            image: this.getImageSrc(imageSrc),
            title: this.cleanTitle(title || 'Unknown'),
            subtitle: subtitle ? this.cleanTitle(subtitle) : undefined
        })
    }

    // --- MANGA DETAILS ---

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let rawTitle = $('.title-detail').text().trim() || $('h1').first().text().trim() || $('title').text().trim()
        const title = this.cleanTitle(rawTitle)
        
        const image = this.getImageSrc($('.col-image img').attr('src'))
        let desc = this.decodeHTMLEntity($('.detail-content p').first().text().trim())
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? 'No description'

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

    // --- CAPITOLI ---

    getChapterPageCount($: any): number {
        let maxPage = 1
        $('.pagination li a').each((_: any, el: any) => {
            const href = $(el).attr('href')
            const text = $(el).text().trim()
            const textNum = parseInt(text)
            
            if (!isNaN(textNum)) {
                if (textNum > maxPage) maxPage = textNum
            } else if (href) {
                const match = href.match(/[?&]page=(\d+)/)
                if (match) {
                    const num = parseInt(match[1])
                    if (num > maxPage) maxPage = num
                }
            }
        })
        return maxPage
    }

    // Logica di naming estratta per pulizia
    private processChapterTitle(rawTitle: string, mangaId: string): { name: string, chapNum: number, volume?: number } {
        let cleanName = rawTitle.replace(/^.*?\(\d{4}\)\s*/, '').trim()
        const looseMangaName = mangaId.replace(/-/g, ' ')
        if (cleanName === rawTitle && rawTitle.toLowerCase().includes(looseMangaName)) {
             cleanName = rawTitle.replace(new RegExp(looseMangaName, 'gi'), '').trim()
        }
        cleanName = cleanName.replace(/^_+|_+$/g, '')

        // Regex flessibile (spazi o underscore)
        const multiPartMatch = cleanName.match(/_?([a-zA-Z_\s]+)[\s_](\d+)[\s_]?\(?Part[\s_](\d+)\)?/i)
        const specialMatch = cleanName.match(/_?([a-zA-Z_\s]+)[\s_](\d+)/i)
        const issueMatch = cleanName.match(/(?:Issue|Chapter|^)\s*#?(\d+(\.\d+)?)/i)

        if (multiPartMatch && (cleanName.toLowerCase().includes('part') || cleanName.toLowerCase().includes('edition'))) {
            let type = multiPartMatch[1]?.replace(/_/g, ' ').trim() ?? 'Vol'
            const volNum = parseInt(multiPartMatch[2] ?? '0')
            const partNum = parseFloat(multiPartMatch[3] ?? '0')
            return { name: `Vol. ${type} ${volNum} Part. ${partNum}`, chapNum: partNum } // Vol opzionale rimosso per visualizzazione
        } 
        else if (specialMatch && !cleanName.toLowerCase().includes('issue') && !cleanName.toLowerCase().includes('chapter')) {
            let type = specialMatch[1]?.replace(/_/g, ' ').trim()
            const num = parseFloat(specialMatch[2] ?? '0')
            return { name: `Vol. ${type} ${num}`, chapNum: num }
        }
        else if (issueMatch) {
            const chapNum = parseFloat(issueMatch[1] ?? '0')
            return { name: `Ch. ${chapNum}`, chapNum: chapNum }
        } 
        else {
            const fallbackNum = cleanName.match(/(\d+(\.\d+)?)/g)
            let chapNum = 0
            if (fallbackNum) chapNum = parseFloat(fallbackNum[fallbackNum.length - 1] ?? '0')
            return { name: cleanName.replace(/_/g, ' ').trim(), chapNum: chapNum }
        }
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

            const { name, chapNum } = this.processChapterTitle(rawTitle, mangaId)

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
        
        // 1. Script JS
        const scriptMatch = html.match(/var\s+lstImages\s*=\s*new\s+Array\((.*?)\);/)
        if (scriptMatch && scriptMatch[1]) {
            const urls = scriptMatch[1].split(',').map((u: string) => u.trim().replace(/['"]/g, ''))
            for (const url of urls) {
                const clean = this.getImageSrc(url)
                if (clean && !clean.includes('logo-alt')) pages.push(clean)
            }
        }
        
        // 2. Fallback Data-Original (LazyLoad)
        if (pages.length === 0) {
            const imgRegex = /<img[^>]+data-original=["']([^"']+)["']/g
            let match
            while ((match = imgRegex.exec(html)) !== null) {
                const url = this.getImageSrc(match[1])
                if (url && !url.includes('logo-alt')) pages.push(url)
            }
        }

        // 3. Fallback Src (Standard)
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