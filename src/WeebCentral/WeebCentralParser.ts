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

export class WeebCentralParser {

    decodeHTMLEntity(str: string): string {
        return str.replace(/&#(\d+);/g, (_match, dec) => {
            return String.fromCharCode(dec)
        }).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    }

    // Helper centralizzato (Logica di Gabe)
    private parseCommonManga($: any, element: any, extraSubtitle?: string): PartialSourceManga | null {
        const item = $(element)
        
        // Cerca il link alla serie
        const link = item.is('a') ? item : item.find('a[href*="/series/"]').first()
        const href = link.attr('href')
        
        // Estrai ID
        const id = href?.replace(/\/$/, '')?.split('/').slice(-2)[0]
        if (!id) return null

        // Immagine: priorità a source, poi img
        let image = item.find('source').first().attr('srcset')
        if (!image) image = item.find('img').first().attr('src') ?? ''

        // Titolo: priorità all'ALT text (come fa source.js)
        let title = item.find('img').first().attr('alt')
        if (title) {
            title = title.replace(/ cover$/i, '').trim()
        } else {
            title = item.find('.text-lg').text().trim() ?? 'Unknown'
        }
        title = this.decodeHTMLEntity(title)

        // Sottotitolo
        let subtitle = extraSubtitle
        if (!subtitle) {
            subtitle = item.find('div.opacity-70').first().text().trim()
        }

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle ? this.decodeHTMLEntity(subtitle) : undefined
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1').first().text().trim() 
        if (!title) title = $('picture img').attr('alt')?.replace(/ cover$/i, '') ?? 'Unknown'
        title = this.decodeHTMLEntity(title)

        let image = $('picture source').attr('srcset') ?? ''
        if (!image) image = $('picture img').attr('src') ?? ''
        
        const desc = this.decodeHTMLEntity($('p.text-lg').text().trim() || 'No description')

        let status = 'Ongoing'
        let author = 'Unknown'
        let artist = 'Unknown'
        const arrayTags: Tag[] = []

        // Recupero Metadata (Generi, Autori, Stato)
        $('ul.flex.flex-col.gap-4 li').each((_: any, li: any) => {
            const label = $('strong', li).text().trim()
            const links = $('a', li)

            if (label.includes('Author')) {
                author = links.map((_: any, a: any) => $(a).text().trim()).get().join(', ')
            } else if (label.includes('Status')) {
                const statusText = links.first().text().trim().toLowerCase()
                if (statusText.includes('complete')) status = 'Completed'
                else if (statusText.includes('ongoing')) status = 'Ongoing'
                else if (statusText.includes('hiatus')) status = 'Hiatus'
            } else if (label.includes('Tags') || label.includes('Type')) {
                links.each((_: any, a: any) => {
                    const tagLabel = $(a).text().trim()
                    if (tagLabel) {
                        arrayTags.push(App.createTag({ id: tagLabel, label: tagLabel }))
                    }
                })
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
                artist: artist,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any): Chapter[] {
        const chapters: Chapter[] = []

        // Cerca tutti i link che portano a un capitolo
        $('a[href*="/chapters/"]').each((_: any, a: any) => {
            const link = $(a)
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.split('/chapters/')[1]
            if (!chapterId) return

            const name = link.find('span.grow span').first().text().trim()
            const chapNumMatch = name.match(/Chapter\s+(\d+(\.\d+)?)/i)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

            const dateStr = link.find('time').attr('datetime')
            const time = dateStr ? new Date(dateStr) : new Date()

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

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. Hot Updates -> LARGE
        const hotSection = App.createHomeSection({
            id: 'hot',
            title: 'Hot Updates 🔥',
            containsMoreItems: true,
            type: HomeSectionType.singleRowLarge // <--- MODIFICA QUI
        })

        // 2. Recommendations -> NORMAL
        const recSection = App.createHomeSection({
            id: 'recommendations',
            title: 'Recommendations 💡',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })

        // 3. Latest Updates -> NORMAL
        const latestSection = App.createHomeSection({
            id: 'latest',
            title: 'Latest Updates 🆕',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        // Parsing Hot Updates
        const hotManga: PartialSourceManga[] = []
        const hotContainer = $('section:has(h2:contains("Hot Updates"))').first()
        $('article', hotContainer).each((_: any, item: any) => {
            const manga = this.parseCommonManga($, item)
            if (manga) hotManga.push(manga)
        })
        hotSection.items = hotManga
        sectionCallback(hotSection)

        // Parsing Recommendations
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

        // Parsing Latest Updates
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

    parseViewMore($: any): PartialSourceManga[] {
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
    
    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: []
        })
    }
}