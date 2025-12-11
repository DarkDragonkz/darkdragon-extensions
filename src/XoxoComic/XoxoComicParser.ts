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

    getChapterPageCount($: any): number {
        const lastPageLink = $('.pagination li a').last().attr('href')
        if (lastPageLink) {
            const match = lastPageLink.match(/page=(\d+)/)
            if (match) return parseInt(match[1])
        }
        return 1
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

            // --- SMART RENAMING LOGIC ---
            
            // 1. Rimuove prefissi del manga (es "The Sandman (1989)")
            let cleanName = rawTitle.replace(/^.*?\(\d{4}\)\s*/, '').trim()
            // Se la regex fallisce (nessun anno), prova a rimuovere semplicemente il titolo se matcha l'ID
            if (cleanName === rawTitle && rawTitle.toLowerCase().includes(mangaId.replace(/-/g, ' '))) {
                 cleanName = rawTitle.replace(new RegExp(mangaId.replace(/-/g, ' '), 'i'), '').trim()
            }

            let name = cleanName
            let chapNum = 0
            let volume = undefined

            // CASO 1: Multipart (Deluxe Edition, TPB)
            // Pattern: _Tipo_Vol_(Part_Ch) -> Es: _The_Deluxe_Edition_1_(Part_1)
            const multiPartMatch = cleanName.match(/_?([a-zA-Z_]+)_(\d+)_?\(Part_(\d+)\)/i)
            
            if (multiPartMatch) {
                let type = multiPartMatch[1]?.replace(/_/g, ' ').trim() ?? 'Vol' // "The Deluxe Edition"
                const volNum = parseInt(multiPartMatch[2] ?? '0')
                const partNum = parseFloat(multiPartMatch[3] ?? '0')
                
                // Pulizia estetica tipo
                if (type.toUpperCase() === 'TPB') type = 'TPB'
                
                // Formato richiesto: Vol. The Deluxe Edition 1 Ch.1
                name = `Vol. ${type} ${volNum} Ch.${partNum}`
                
                chapNum = partNum
                volume = volNum
            } 
            // CASO 2: Speciali / Annual (Single Part)
            // Pattern: _Special_1
            else {
                const singleSpecialMatch = cleanName.match(/_?([a-zA-Z_]+)_(\d+)/i)
                // Assicuriamoci che non sia un "Issue" camuffato
                if (singleSpecialMatch && !cleanName.toLowerCase().includes('issue') && !cleanName.toLowerCase().includes('chapter')) {
                    const type = singleSpecialMatch[1]?.replace(/_/g, ' ').trim()
                    const num = parseFloat(singleSpecialMatch[2] ?? '0')
                    
                    name = `${type} #${num}`
                    chapNum = num
                }
                // CASO 3: Standard Issue / Chapter
                else {
                    const issueMatch = cleanName.match(/(?:Issue|Chapter)\s*#?(\d+(\.\d+)?)/i)
                    if (issueMatch) {
                        chapNum = parseFloat(issueMatch[1] ?? '0')
                        name = `Issue #${chapNum}`
                    } else {
                        // Fallback: cerca l'ultimo numero
                        const fallbackNum = cleanName.match(/(\d+(\.\d+)?)/g)
                        if (fallbackNum) {
                            chapNum = parseFloat(fallbackNum[fallbackNum.length - 1] ?? '0')
                        }
                        name = cleanName.replace(/_/g, ' ').trim()
                    }
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: volume,
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

        $('.item, .list-truyen-item-wrap').each((_: any, item: any) => {
            const manga = this.parseMangaItem($, item)
            if (manga && !seenIds.has(manga.mangaId)) {
                seenIds.add(manga.mangaId)
                results.push(manga)
            }
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆕', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Popular Comics 🔥', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowLarge 
        })
        
        const items = this.parseGridItems($)
        
        latestSection.items = items
        popularSection.items = items.slice(0, 15)

        sectionCallback(popularSection)
        sectionCallback(latestSection)
    }
}