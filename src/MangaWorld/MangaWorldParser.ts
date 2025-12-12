import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection
} from '@paperback/types'

const BASE_URL = 'https://www.mangaworld.mx'

export class MangaWorldParser {

    private months: Record<string, string> = {
        'gennaio': 'January', 'febbraio': 'February', 'marzo': 'March',
        'aprile': 'April', 'maggio': 'May', 'giugno': 'June',
        'luglio': 'July', 'agosto': 'August', 'settembre': 'September',
        'ottobre': 'October', 'novembre': 'November', 'dicembre': 'December'
    }

    private cleanTitle(title: string): string {
        if (!title) return 'Unknown'
        title = title.trim()
        if (title.length > 0 && title.length % 2 === 0) {
            const half = title.substring(0, title.length / 2)
            if (half === title.substring(title.length / 2)) {
                return half
            }
        }
        return title
    }

    private parseDate(dateStr: string): Date {
        dateStr = dateStr.trim().toLowerCase()
        const now = new Date()

        if (!dateStr) return now
        if (dateStr.includes('oggi')) return now
        if (dateStr.includes('ieri')) return new Date(now.setDate(now.getDate() - 1))

        for (const [it, en] of Object.entries(this.months)) {
            if (dateStr.includes(it)) {
                dateStr = dateStr.replace(it, en)
                break
            }
        }

        const parsed = Date.parse(dateStr)
        if (!isNaN(parsed)) {
            return new Date(parsed)
        }

        return now
    }

    private getImageSrc(element: any): string {
        let image = element.attr('src') ?? ''
        
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = element.attr('data-src') ?? element.attr('data-original') ?? ''
        }
        
        if (image && image.startsWith('/')) {
            image = BASE_URL + image
        }

        return image || 'https://paperback.moe/icons/logo-alt.svg'
    }

    private parseCommonManga($: any, element: any, extraSubtitleSelector?: string): PartialSourceManga {
        const href = $('a', element).attr('href') ?? ''
        const id = href.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0] ?? ''

        let title = $('a', element).attr('title') 
        if (!title) title = $('.name', element).text().trim()
        if (!title) title = $('.manga-title', element).text().trim()
        title = this.cleanTitle(title ?? 'Unknown')

        const imgElement = $('a img', element)
        const image = this.getImageSrc(imgElement)

        let subtitle: string | undefined = undefined
        if (extraSubtitleSelector) {
            subtitle = $(extraSubtitleSelector, element).first().attr('title') ?? $(extraSubtitleSelector, element).first().text().trim()
        }

        return App.createPartialSourceManga({
            image,
            title,
            mangaId: id,
            subtitle
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('.name.bigger').text().trim() ?? ''
        title = this.cleanTitle(title)
        
        const image = this.getImageSrc($('.thumb.mb-3.text-center img'))
        const desc = $('#noidungm').text().trim() ?? ''
        
        let hentai = false
        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        $('.meta-data.row.px-1 .col-12').each((_: any, obj: any) => {
            const text = $(obj).text().trim()
            
            if (text.toLowerCase().includes('autore:')) {
                author = text.replace(/autore:\s*/i, '').trim()
            } else if (text.toLowerCase().includes('artista:')) {
                artist = text.replace(/artista:\s*/i, '').trim()
            } else if (text.toLowerCase().includes('stato:')) {
                const statusText = $('a', obj).text().trim().toLowerCase()
                if (statusText.includes('finito') || statusText.includes('completato')) {
                    status = 'Completed'
                }
            }
        })

        const arrayTags: Tag[] = []
        $('.meta-data.row.px-1 .col-12 a[href*="genre="]').each((_: any, e: any) => {
            const label = $(e).text().trim()
            const id = $(e).attr('href')?.split('genre=')[1] ?? label
            
            if (['ADULTI', 'SMUT', 'MATURO', 'HENTAI'].includes(id.toUpperCase())) hentai = true
            if (id && label) arrayTags.push({ id, label })
        })

        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags.map(x => App.createTag(x)) })]
        
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                status: status as any,
                artist,
                author,
                tags: tagSections,
                desc,
                hentai,
            }),
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const addedIds = new Set<string>()

        let seriesName = $('.name.bigger').text().trim()
        seriesName = this.cleanTitle(seriesName)

        // Logica Volumi
        const volumeElements = $('.volume-element').toArray()
        
        if (volumeElements.length > 0) {
            for (const volumeEl of volumeElements) {
                const volName = $('.volume-name', volumeEl).text().trim()
                const volMatch = volName.match(/Volume\s+(\d+)/i)
                const volumeNumber = volMatch ? Number(volMatch[1]) : undefined

                const chapterNodes = $('.chapter', volumeEl).toArray()
                for (const node of chapterNodes) {
                    this.processChapter($, node, mangaId, seriesName, chapters, addedIds, volumeNumber)
                }
            }
        } 
        
        // Logica Fallback (Webtoon senza volumi o capitoli orfani)
        const allChapters = $('.chapter').toArray()
        for (const node of allChapters) {
            // processChapter controlla internamente se l'ID è già stato aggiunto
            this.processChapter($, node, mangaId, seriesName, chapters, addedIds, undefined)
        }

        return chapters
    }

    private processChapter($: any, item: any, mangaId: string, seriesName: string, chapters: Chapter[], addedIds: Set<string>, volume?: number) {
        const link = $('a.chap', item)
        const href = link.attr('href')
        if (!href) return

        const id = href.replace(`${BASE_URL}/manga/${mangaId}/read/`, '')
        
        if (addedIds.has(id)) return
        addedIds.add(id)

        const chapText = $('.d-inline-block', item).text().trim()
        const chapNumMatch = chapText.match(/(\d+(\.\d+)?)/)
        const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

        let rawName = link.attr('title') ?? ''
        
        // Pulizia nome capitolo
        let name = rawName.replace(new RegExp(seriesName, 'gi'), '').trim()
        name = name.replace(/scan ita/gi, '')
                   .replace(/ita/gi, '')
                   .replace(/capitolo\s*\d+(\.\d+)?/gi, '')
                   .replace(/-|\s+$/g, '')
                   .trim()

        if (!name || name.length < 2) {
            name = '' 
        }

        const dateText = $('.chap-date', item).text().trim()
        const time = this.parseDate(dateText)

        chapters.push(
            App.createChapter({
                id,
                name,
                chapNum,
                volume,
                time,
                langCode: 'it',
            })
        )
    }

    parseChapterDetails($: any, mangaId: string, id: string): ChapterDetails {
        const pages: string[] = []
        
        $('.col-12.text-center.position-relative img').each((_: any, item: any) => {
            const url = this.getImageSrc($(item))
            if (url && !url.includes('logo-alt.svg')) { 
                pages.push(url.trim())
            }
        })

        return App.createChapterDetails({
            id,
            mangaId,
            pages,
        })
    }

    parseTags($: any, baseUrl: string): TagSection[] {
        const genres: Tag[] = []
        const seen = new Set<string>()

        $('.dropdown-menu.dropdown-multicol .dropdown-item').each((_: any, item: any) => {
            const id = $(item).attr('href')?.split('genre=')[1]
            const label = $(item).text().trim()
            
            if (id && label && !seen.has(id)) {
                seen.add(id)
                genres.push(App.createTag({ label, id }))
            }
        })
        return [App.createTagSection({ id: '0', label: 'Generi', tags: genres })]
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            results.push(this.parseCommonManga($, item))
        })
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const sectionMonth = App.createHomeSection({
            id: '2', 
            title: 'Manga del Mese 🌟',
            containsMoreItems: true,
            type: HomeSectionType.singleRowLarge 
        })

        const sectionLatest = App.createHomeSection({
            id: '1',
            title: 'Ultimi Capitoli 🔥',
            containsMoreItems: true,
            type: HomeSectionType.continuous 
        })

        const sectionTrending = App.createHomeSection({
            id: '3',
            title: 'In Tendenza 📈',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal,
        })

        // Selettore comune per trovare l'ultimo capitolo nelle card
        // Questo cerca un link dentro un div che di solito contiene il capitolo
        const chapterSelector = '.d-flex.flex-wrap.flex-row a, .chapter a, .latest-chapter'

        // 1. Popolamento MANGA DEL MESE (Vetrina)
        const monthItems: PartialSourceManga[] = []
        $('.col-12 .top-wrapper .entry').each((i: number, item: any) => {
            // ORA passiamo il selettore del capitolo anche qui!
            // Prima era: this.parseCommonManga($, item)
            if (i < 10) monthItems.push(this.parseCommonManga($, item, chapterSelector))
        })
        sectionMonth.items = monthItems
        sectionCallback(sectionMonth)

        // 2. Popolamento ULTIMI CAPITOLI (Colonna centrale)
        const latestItems: PartialSourceManga[] = []
        $('.col-sm-12.col-md-8.col-xl-9 .comics-grid .entry').each((_: any, item: any) => {
            latestItems.push(this.parseCommonManga($, item, chapterSelector))
        })
        sectionLatest.items = latestItems
        sectionCallback(sectionLatest)

        // 3. Popolamento IN TENDENZA (Sidebar)
        // La sidebar spesso non ha il capitolo visibile, ma proviamo comunque
        const trendingItems: PartialSourceManga[] = []
        $('.entry.vertical').each((_: any, item: any) => {
            trendingItems.push(this.parseCommonManga($, item, chapterSelector))
        })
        sectionTrending.items = trendingItems
        sectionCallback(sectionTrending)
    }

    parseViewMore($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            results.push(this.parseCommonManga($, item, '.d-flex.flex-wrap.flex-row a'))
        })
        return results
    }
}