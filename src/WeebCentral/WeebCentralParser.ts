import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    PartialSourceManga,
    SourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

export class WeebCentralParser {

    /**
     * Helper centralizzato per estrarre un manga da un elemento HTML.
     */
    private parseCommonManga($: any, element: any, extraSubtitle?: string): PartialSourceManga | null {
        let item = $(element)
        
        let link = item.is('a') ? item : item.find('a[href*="/series/"]').first()
        const href = link.attr('href')
        
        const id = href?.split('/series/')[1]?.split('/')[0]
        if (!id) return null

        let title = item.attr('data-tip') ?? 
                    item.find('[data-tip]').attr('data-tip') ?? 
                    item.find('.text-white, .font-bold').first().text().trim()

        if (!title) title = 'Unknown Title'

        let image = item.find('img').first().attr('src') ?? 
                    item.find('img').first().attr('data-src') ?? 
                    ''
        
        let subtitle = extraSubtitle
        if (!subtitle) {
            const possibleChapter = item.find('a[href*="/chapters/"] span').last().text().trim()
            if (possibleChapter) subtitle = possibleChapter
        }

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1').first().text().trim()
        if (!title) title = $('section:has(picture)').first().attr('data-tip') ?? 'Unknown'
        
        const image = $('img[alt$=" cover"]').attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'
        
        const desc = $('.whitespace-pre-wrap').text().trim() || 'No description available'
        
        const author = $('strong:contains("Author(s)")').next().find('a').text().trim() || 'Unknown'

        const statusStr = $('strong:contains("Status")').next('a').text().trim().toLowerCase()
        let status = 'Ongoing'
        if (statusStr.includes('complete')) status = 'Completed'
        else if (statusStr.includes('hiatus')) status = 'Hiatus'
        else if (statusStr.includes('cancel')) status = 'Completed' 

        // FIX ERRORE 305: Uso esplicito di App.createTag
        const arrayTags: Tag[] = []
        $('strong:contains("Tags(s)")').nextAll('span').each((_: any, span: any) => {
            const label = $(span).text().trim()
            if (label) {
                // Questo risolve l'errore "Invalid type for key tags"
                arrayTags.push(App.createTag({ id: label, label: label }))
            }
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

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('a[href*="/chapters/"]').each((_: any, element: any) => {
            const item = $(element)
            const href = item.attr('href')
            const id = href?.split('/chapters/')[1]
            if (!id) return

            let name = item.find('.grow span, span.font-bold').first().text().trim()
            
            if (!name) {
                const clone = item.clone()
                clone.find('time').remove()
                name = clone.text().trim()
            }

            name = name.replace(/\s+/g, " ").trim()

            const numMatch = name.match(/(\d+(\.\d+)?)/g)
            const chapNum = numMatch ? parseFloat(numMatch[numMatch.length - 1] ?? '0') : 0

            const timeStr = item.find('time').attr('datetime')
            const time = timeStr ? new Date(timeStr) : new Date()

            chapters.push(App.createChapter({
                id: id,
                name: name, 
                chapNum: chapNum,
                langCode: 'en',
                time: time
            }))
        })

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        $('img').each((_: any, img: any) => {
            let src = $(img).attr('src') || $(img).attr('data-src')
            
            if (src && !src.includes('logo') && !src.includes('icon')) {
                pages.push(src.trim())
            }
        })
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('article, a[href*="/series/"]').each((_: any, item: any) => {
            if ($(item).find('img').length === 0) return

            const manga = this.parseCommonManga($, item)
            if (manga && manga.title !== 'Official') {
                if (!results.some(r => r.mangaId === manga.mangaId)) {
                    results.push(manga)
                }
            }
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const hotSection = App.createHomeSection({
            id: 'hot_updates',
            title: 'Hot Updates 🔥',
            containsMoreItems: false,
            type: HomeSectionType.singleRowLarge, 
        })
        
        const recSection = App.createHomeSection({
            id: 'recommendations',
            title: 'Recommendations 💡',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal, 
        })

        const latestSection = App.createHomeSection({
            id: 'latest_updates',
            title: 'Latest Updates 🆙',
            containsMoreItems: true,
            type: HomeSectionType.continuous,
        })

        const hotManga: PartialSourceManga[] = []
        const hotContainer = $('section:has(h2:contains("Hot Updates"))').first()
        $('article', hotContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga) hotManga.push(manga)
        })
        hotSection.items = hotManga
        sectionCallback(hotSection)

        const recManga: PartialSourceManga[] = []
        const recContainer = $('section:has(h2:contains("Recommendations"))').first()
        $('article', recContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga) recManga.push(manga)
        })
        if (recManga.length > 0) {
            recSection.items = recManga
            sectionCallback(recSection)
        }

        const latestManga: PartialSourceManga[] = []
        const latestContainer = $('section:has(h2:contains("Latest Updates"))').first()
        $('article', latestContainer).each((_: any, item: any) => {
            const chapterText = $(item).find('span').last().text().trim()
            const manga = this.parseCommonManga($, item, chapterText)
            if (manga) latestManga.push(manga)
        })
        latestSection.items = latestManga
        sectionCallback(latestSection)
    }

    isLastPage($: any): boolean {
        return $(`span:contains("View More Results...")`).length === 0
    }
}