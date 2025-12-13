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

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1').first().text().trim()
        if (!title) title = 'Unknown Title'

        let image = $('img[alt="' + title + '"]').first().attr('src')
        if (!image) image = $('section img').first().attr('src') ?? ''
        
        let desc = ''
        const descEl = $('p:contains("Description"), div:contains("Description")').last().next()
        if (descEl.length > 0) desc = descEl.text().trim()
        if (!desc) desc = $('p.leading-6').first().text().trim()
        
        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        $('strong, span.font-bold').each((_: any, el: any) => {
            const label = $(el).text().trim()
            const value = $(el).next().text().trim() || $(el).parent().next().text().trim()
            
            if (label.includes('Author')) author = value
            if (label.includes('Artist')) artist = value
            if (label.includes('Status')) status = value
        })

        if (artist === 'Unknown' && author !== 'Unknown') artist = author

        if (status.toLowerCase().includes('complete')) status = 'Completed'
        if (status.toLowerCase().includes('hiatus')) status = 'Hiatus'
        if (status.toLowerCase().includes('cancel')) status = 'Cancelled'

        const arrayTags: Tag[] = []
        $('a[href*="/search/data?tags="]').each((_: any, el: any) => {
            const label = $(el).text().trim()
            if (label) arrayTags.push({ id: label, label: label })
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
                desc: desc || 'No description available.'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('a[href*="/chapters/"]').each((_: any, el: any) => {
            const $el = $(el)
            const href = $el.attr('href')
            
            const chapterId = href?.split('/chapters/')[1]
            if (!chapterId) return

            const titleRaw = $el.find('span.font-bold, span.grow').first().text().trim()
            const timeRaw = $el.find('time').attr('datetime') || new Date().toISOString()
            
            const chapNumMatch = titleRaw.match(/(\d+(\.\d+)?)/)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1])
            }

            let name = titleRaw
            name = name.replace(/^(chapter|ch|episode|ep|no\.|#)\.?\s*\d+/i, '').trim()
            name = name.replace(/^[-–—:]+\s*/, '').trim()

            if (name === String(chapNum) || name === '') name = ''

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: new Date(timeRaw),
                langCode: 'en'
            }))
        })

        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        $('img').each((_: any, el: any) => {
            const $img = $(el)
            let src = $img.attr('src')
            
            if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
                pages.push(src)
            }
        })
        
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // HELPER FIXATO: Supporta Episode e Link diretti
    private extractSubtitle($el: any): string | undefined {
        // 1. Cerca testo con parole chiave estese (Chapter, Episode, etc.)
        let sub = $el.find('span:contains("Chapter"), span:contains("Ch"), span:contains("Episode"), span:contains("Ep"), a:contains("Chapter")').last().text().trim()
        
        // 2. Se non trova etichette, cerca un LINK a un capitolo (Strategia per Latest Updates)
        if (!sub) {
            // Cerca il primo link nel blocco che punta a /chapters/
            // Spesso in "Latest" c'è solo un link col numero "155" o "Ep. 10"
            const chapterLink = $el.find('a[href*="/chapters/"]').first()
            if (chapterLink.length > 0) {
                // Prendi il testo intero del link (es. "Chapter 123" o "123")
                // A volte il testo è dentro uno span nel link
                sub = chapterLink.text().trim()
            }
        }

        // 3. Pulizia finale: Rimuove date ISO lunghe se erroneamente catturate
        if (sub && (sub.length > 30 || (sub.includes('T') && sub.includes(':') && sub.includes('-')))) {
            return undefined 
        }
        
        return sub || undefined
    }

    private cleanTitle(title: string): string {
        return title
            .replace(/\s+Cover$/i, '')
            .replace(/\s+Poster$/i, '')
            .replace(/\s+Scan$/i, '')
            .trim()
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            const img = $el.find('img').first()
            
            let image = img.attr('src')
            if (!image) {
                image = $el.closest('article, div').find('img').first().attr('src')
            }
            if (!image) return

            const href = $el.attr('href')
            const id = href?.split('/series/')[1]
            if (!id) return

            let title = img.attr('alt') || $el.text().trim() || 'Unknown'
            title = this.cleanTitle(title)

            const subtitle = this.extractSubtitle($el.closest('article, div'))

            if (!results.find(r => r.mangaId === id)) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const hotSection = App.createHomeSection({ id: 'hot', title: 'Hot Updates 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Recent Updates 🆕', containsMoreItems: true, type: HomeSectionType.continuous })

        const hotItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        // 1. HOT UPDATES
        const hotContainer = $('section:contains("Hot Updates"), section:contains("Popular")').first()
        
        hotContainer.find('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            const img = $el.find('img').first()
            if (img.length === 0) return 

            const id = $el.attr('href')?.split('/series/')[1]
            if (!id) return

            let title = img.attr('alt') || 'Unknown'
            title = this.cleanTitle(title)
            const image = img.attr('src') || ''
            
            // Cerca il sottotitolo nel genitore della card
            const card = $el.closest('div.relative, div.flex-col, article')
            const subtitle = this.extractSubtitle(card.length ? card : $el.parent())

            hotItems.push(App.createPartialSourceManga({
                mangaId: id, image: image, title: title, subtitle: subtitle
            }))
        })

        // 2. RECENT UPDATES
        let recentContainer = $('section:contains("Recent"), section:contains("Latest")').first()
        if (recentContainer.length === 0) recentContainer = $('body')

        recentContainer.find('a[href*="/series/"]').each((_: any, el: any) => {
             const $el = $(el)
             
             const href = $el.attr('href')
             const id = href?.split('/series/')[1]
             if (!id) return
             if (hotItems.find(x => x.mangaId === id)) return 

             let image = $el.find('img').attr('src')
             let title = $el.find('img').attr('alt')
             
             if (!image) {
                 const card = $el.closest('div, tr')
                 image = card.find('img').first().attr('src')
                 title = card.find('a.font-bold, a.text-white').first().text().trim()
             }
             
             if (!image) return 

             title = this.cleanTitle(title || 'Unknown')
             
             // Cerca sottotitolo nel contenitore
             // In Latest Updates spesso il contenitore è una riga o grid item
             const subtitle = this.extractSubtitle($el.closest('div, tr, article'))

             latestItems.push(App.createPartialSourceManga({
                 mangaId: id, image: image, title: title, subtitle: subtitle
             }))
        })

        hotSection.items = hotItems
        latestSection.items = latestItems
        
        sectionCallback(hotSection)
        sectionCallback(latestSection)
    }
}