import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
    MangaInfo
} from '@paperback/types'

// Nota: Assicurati di avere 'entities' installato o gestito nel tuo bundle
import { decodeHTML } from 'entities'

export class Parser {

    decodeHTMLEntity(str: string): string {
        return decodeHTML(str)
    }

    isLastPage($: any): boolean {
        return $('span:contains("View More Results...")').toArray().length === 0
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h1').first().text().trim()
        const image = $('picture > img').attr('src') ?? ''
        const description = this.decodeHTMLEntity($('.whitespace-pre-wrap').text().trim())
        
        const authors: string[] = []
        for (const authorObj of $('strong:contains("Author")').siblings().toArray()) {
            const author = $('a', authorObj).text().trim()
            authors.push(author)
        }
        const author = authors.join(', ')

        const parsedStatus = $('strong:contains("Status")').next().text().trim()
        let status = 'Unknown'
        switch (parsedStatus) {
            case 'Ongoing': status = 'Ongoing'; break
            case 'Complete': status = 'Completed'; break
            case 'Hiatus': status = 'Hiatus'; break
            case 'Canceled': status = 'Cancelled'; break
            default: status = 'Unknown'; break
        }

        const arrayTags: Tag[] = []
        for (const tagObj of $('strong:contains("Tags")').siblings().toArray()) {
            const label = $('a', tagObj).text().trim()
            const id = $('a', tagObj).attr('href')?.split('?included_tag=')[1] ?? label
            if (!id || !label) continue
            arrayTags.push({ id: id, label: label })
        }
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
                desc: description,
            }),
        })
    }

    parseChapters($: any): Chapter[] {
        const chapters: Chapter[] = []

        for (const chapter of $('a[href*="/chapters/"]').toArray()) {
            const title = $('span', chapter).first().text().trim()
            const id = $(chapter).attr('href')?.split('/chapters/')[1] ?? ''
            const date = new Date($('time', chapter).attr('datetime') ?? '')
            
            // Regex per estrarre il numero del capitolo (es. "Chapter 200")
            const chapterNumberMatch = title.match(/Chapter\s+(\d+(\.\d+)?)/)
            const chapterNumber = chapterNumberMatch ? parseFloat(chapterNumberMatch[1]) : 0

            if (!id) continue

            chapters.push(App.createChapter({
                id: id,
                name: title,
                langCode: 'English',
                chapNum: chapterNumber,
                time: date,
            }))
        }
        return chapters
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // --- MODIFICA UI QUI: Hot Updates -> Large Cover ---
        const hotSection = App.createHomeSection({
            id: 'hot',
            title: 'Hot Updates',
            containsMoreItems: true,
            type: HomeSectionType.singleRowLarge 
        })
        // ---------------------------------------------------

        const recommendationSection = App.createHomeSection({
            id: 'recommendations',
            title: 'Recommendations',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal,
        })

        const latestSection = App.createHomeSection({
            id: 'latest',
            title: 'Latest Updates',
            containsMoreItems: true,
            type: HomeSectionType.continuous,
        })

        // --- Parsing Hot Updates ---
        const hotManga: PartialSourceManga[] = []
        const hotContainer = $('section:has(h2:contains("Hot Updates"))').first()
        $('article', hotContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga) hotManga.push(manga)
        })
        hotSection.items = hotManga
        sectionCallback(hotSection)

        // --- Parsing Recommendations ---
        const recManga: PartialSourceManga[] = []
        const recContainer = $('section:has(h2:contains("Recommendations"))').first()
        $('article', recContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga) recManga.push(manga)
        })
        if (recManga.length > 0) {
            recommendationSection.items = recManga
            sectionCallback(recommendationSection)
        }

        // --- Parsing Latest Updates ---
        const latestManga: PartialSourceManga[] = []
        const latestContainer = $('section:has(h2:contains("Latest Updates"))').first()
        $('article', latestContainer).each((_: any, item: any) => {
            const chapterText = $(item).find('a[href*="/chapters/"] span').last().text().trim()
            const manga = this.parseCommonManga($, item, chapterText)
            if (manga) latestManga.push(manga)
        })
        latestSection.items = latestManga
        sectionCallback(latestSection)
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const collectedIds: string[] = []

        $('article').each((_: any, article: any) => {
            const manga = this.parseCommonManga($, article)
            if (manga && !collectedIds.includes(manga.mangaId)) {
                results.push(manga)
                collectedIds.push(manga.mangaId)
            }
        })

        return results
    }

    parseViewMore($: any, homepageSectionId: string): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        const collectedIds: string[] = []
        
        // Selettore specifico per Hot Updates se necessario, altrimenti generico
        const selector = homepageSectionId === 'hot' ? 'article.flex' : 'article'

        for (const obj of $(selector).toArray()) {
            // Usa la logica comune per estrarre i dati
            const item = this.parseCommonManga($, obj)
            
            if (!item || collectedIds.includes(item.mangaId)) continue

            manga.push(item)
            collectedIds.push(item.mangaId)
        }
        return manga
    }

    /**
     * Helper centralizzato per estrarre un manga da un elemento HTML.
     * Logica presa dai tuoi file funzionanti.
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

        if (!title) title = item.find('img').first().attr('alt')?.replace(/ cover$/i, '') ?? 'Unknown Title'

        let image = item.find('img').first().attr('src') ?? 
                    item.find('img').first().attr('data-src') ?? 
                    item.find('source').first().attr('srcset') ??
                    ''
        
        let subtitle = extraSubtitle
        if (!subtitle) {
            const possibleChapter = item.find('a[href*="/chapters/"] span').last().text().trim()
            if (possibleChapter) subtitle = possibleChapter
        }

        return App.createPartialSourceManga({
            image: image,
            title: this.decodeHTMLEntity(title),
            mangaId: id,
            subtitle: subtitle ? this.decodeHTMLEntity(subtitle) : undefined,
        })
    }
}