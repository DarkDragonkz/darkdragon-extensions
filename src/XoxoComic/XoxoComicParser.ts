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

    /**
     * Helper per parsare la griglia generica (usato in Search e View More)
     */
    parseGridItems($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // Cerca item generici (usati nelle pagine dedicate /comic-update, /hot-comic ecc)
        $('.item, .list-truyen-item-wrap, .search-story-item').each((_: any, item: any) => {
            const el = $(item)
            let link = el.find('a').first()
            if (!link.attr('href')) link = el.find('h3 a').first()

            const href = link.attr('href')
            const id = href?.split('/').filter((p: string) => p && p !== 'comic').pop()

            if (!id || seenIds.has(id)) return

            let title = el.find('h3').text().trim()
            if (!title) title = link.attr('title') || link.text().trim()
            if (!title) title = 'Unknown Title'

            let imageSrc = el.find('img').first().attr('src') || el.find('img').first().attr('data-original')
            const image = this.getImageSrc(imageSrc)
            const subtitle = el.find('.chapter a').first().text().trim()

            seenIds.add(id)
            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: subtitle || undefined
            }))
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        // --- 1. TRENDING COMICS (Vetrina Grande) ---
        const trendingSection = App.createHomeSection({ 
            id: 'trending', 
            title: 'Trending Comics 🔥', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowLarge 
        })
        const trendingItems: PartialSourceManga[] = []
        
        // Selettore specifico dal file "Trending Comics.txt"
        $('.items-slide .owl-item .item').each((_: any, item: any) => {
            const el = $(item)
            const link = el.find('a').first() // Il link è sull'immagine
            const id = link.attr('href')?.split('/').pop()
            
            const title = el.find('.slide-caption h3 a').text().trim()
            // Immagine: lazyOwl o src
            const imageSrc = el.find('img').attr('src') || el.find('img').attr('data-src') || el.find('img').attr('class')?.includes('lazyOwl') && el.find('img').attr('data-src')
            
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
        trendingSection.items = trendingItems
        sectionCallback(trendingSection)


        // --- 2. LATEST UPDATES (Scroll Infinito) ---
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆕', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })
        const latestItems: PartialSourceManga[] = []
        
        // Selettore specifico dal file "Latest Updates.txt" (.Module-163 .item)
        $('.Module-163 .items .row .item').each((_: any, item: any) => {
            const el = $(item)
            const figcaption = el.find('figure figcaption')
            
            const titleLink = figcaption.find('h3 a')
            const id = titleLink.attr('href')?.split('/').pop()
            const title = titleLink.text().trim()
            
            const imageSrc = el.find('figure .image img').attr('src')
            const image = this.getImageSrc(imageSrc)
            
            // Capitolo: dentro ul > li > i o a
            const chapter = figcaption.find('ul li a').first().text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }))
            }
        })
        latestSection.items = latestItems
        sectionCallback(latestSection)


        // --- 3. TOP MONTH (Lista Orizzontale) ---
        const monthSection = App.createHomeSection({ 
            id: 'top_month', 
            title: 'Top Month ⭐', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        const monthItems: PartialSourceManga[] = []

        // Selettore specifico dal file "Top Month.txt" (#topMonth)
        $('#topMonth li.clearfix').each((_: any, item: any) => {
            const el = $(item)
            const link = el.find('h3.title a')
            const id = link.attr('href')?.split('/').pop()
            const title = link.text().trim()
            
            const imageSrc = el.find('.thumb img').attr('src') || el.find('.thumb img').attr('data-original')
            const image = this.getImageSrc(imageSrc)
            
            const chapter = el.find('p.chapter a').text().trim()

            if (id && title) {
                monthItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }))
            }
        })
        monthSection.items = monthItems
        sectionCallback(monthSection)


        // --- 4. TOP WEEK (Lista Orizzontale) ---
        const weekSection = App.createHomeSection({ 
            id: 'top_week', 
            title: 'Top Week ⚡', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })
        const weekItems: PartialSourceManga[] = []

        // Selettore specifico dal file "Top Week.txt" (#topWeek)
        $('#topWeek li.clearfix').each((_: any, item: any) => {
            const el = $(item)
            const link = el.find('h3.title a')
            const id = link.attr('href')?.split('/').pop()
            const title = link.text().trim()
            
            const imageSrc = el.find('.thumb img').attr('src') || el.find('.thumb img').attr('data-original')
            const image = this.getImageSrc(imageSrc)
            
            const chapter = el.find('p.chapter a').text().trim()

            if (id && title) {
                weekItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }))
            }
        })
        weekSection.items = weekItems
        sectionCallback(weekSection)
    }

    // --- LE ALTRE FUNZIONI (Dettagli, Capitoli) RIMANGONO INVARIATE ---
    // (Incollo qui per completezza del file parser, usando la versione aggiornata dei capitoli)

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
                if (url && !url.startsWith('data:') && !url.includes('loading')) pages.push(this.getImageSrc(url))
            }
        }
        return App.createChapterDetails({ id: chapterId, mangaId: mangaId, pages: pages })
    }
}