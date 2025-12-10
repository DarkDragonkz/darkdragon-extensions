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

const BASE_URL = 'https://batcave.biz'

export class BatCaveParser {

    /**
     * Helper per parsare le liste di manga (Grid/List items).
     * Riduce drasticamente la duplicazione del codice.
     */
    parseGridItems($: any, selector: string, subtitleSelector?: string): PartialSourceManga[] {
        const items: PartialSourceManga[] = []
        
        $(selector).each((_: any, item: any) => {
            // Gestione ibrida: a volte l'item è il link stesso, a volte è un container
            const link = $(item).is('a') ? $(item) : $('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/').pop()
            
            // Gestione titolo: prova selettori comuni o fallback
            const title = $('.poster__title, .latest__title a, .readed__title a, .popular__title', item).first().text().trim() || link.text().trim()

            // Gestione Immagine: data-src (lazyload) ha priorità
            let image = $('img', item).attr('data-src') ?? $('img', item).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            // Gestione Sottotitolo (es. Capitolo o update)
            let subtitle: string | undefined = undefined
            if (subtitleSelector) {
                const subText = $(subtitleSelector, item).text().trim()
                // Pulisce "Chapter 5" -> "5" o mantiene testo breve
                subtitle = subText.replace(/chapter\s*/i, '').trim()
            }

            if (id && title) {
                items.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })

        return items
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h1.main-page-title').text().trim() || $('h1').first().text().trim() || 'Unknown'
        
        let image = $('.page__poster img').attr('src') ?? ''
        if (image.startsWith('/')) image = BASE_URL + image

        const desc = $('.page__text').text().trim()
        
        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        $('.page__list li').each((_: any, li: any) => {
            const text = $(li).text().trim()
            if (text.includes('Writer:')) author = text.replace('Writer:', '').trim()
            if (text.includes('Artist:')) artist = text.replace('Artist:', '').trim()
            if (text.includes('Release type:')) {
                const type = text.replace('Release type:', '').trim().toLowerCase()
                if (type.includes('completed')) status = 'Completed'
            }
        })

        const arrayTags: Tag[] = []
        $('.page__tags a').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('/').filter(Boolean).pop() ?? label
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
                artist: artist,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters(html: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Estrazione JSON dai dati globali (Ottimo approccio!)
        const scriptData = html.match(/window\.__DATA__\s*=\s*({.*?});/s)
        if (!scriptData) return []

        try {
            const data = JSON.parse(scriptData[1])
            if (data.chapters && Array.isArray(data.chapters)) {
                for (const chap of data.chapters) {
                    const id = String(chap.id)
                    const titleRaw = (chap.title || `Chapter ${chap.id}`).replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
                    
                    let time = new Date()
                    if (chap.date) {
                        // Formato atteso: dd.mm.yyyy
                        const parts = chap.date.split('.')
                        if (parts.length === 3) {
                            time = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                        }
                    }

                    // Logica recupero numero capitolo robusta
                    let chapNum = 0
                    if (chap.posi) {
                        chapNum = parseFloat(chap.posi)
                    } else {
                        // Regex per catturare numeri anche in "Vol.2 Ch.10.5"
                        const numMatch = titleRaw.match(/(\d+(\.\d+)?)/g)
                        if (numMatch) {
                            chapNum = parseFloat(numMatch[numMatch.length - 1] ?? '0')
                        }
                    }

                    chapters.push(App.createChapter({
                        id: id,
                        name: titleRaw,
                        chapNum: chapNum,
                        time: time,
                        langCode: 'en'
                    }))
                }
            }
        } catch (e) {
            console.error(`Error parsing chapters JSON: ${e}`)
        }

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        const scriptData = html.match(/window\.__DATA__\s*=\s*({.*?});/s)
        
        if (scriptData) {
            try {
                const data = JSON.parse(scriptData[1])
                if (data.images && Array.isArray(data.images)) {
                    for (const img of data.images) {
                         if (img && !img.includes('logo') && !img.includes('icon')) {
                             let cleanImg = img
                             if (cleanImg.startsWith('//')) cleanImg = 'https:' + cleanImg
                             else if (cleanImg.startsWith('/')) cleanImg = BASE_URL + cleanImg
                             pages.push(cleanImg)
                         }
                    }
                }
            } catch (e) {
                console.error(`Error parsing images JSON: ${e}`)
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. Featured - Large
        const featuredSection = App.createHomeSection({ 
            id: 'featured', 
            title: 'Featured Comics 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })
        featuredSection.items = this.parseGridItems($, '.sect--popular .poster')
        sectionCallback(featuredSection)

        // 2. Hot New Releases - Normal
        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot New Releases ⚡', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        hotSection.items = this.parseGridItems($, '.sect--hot .poster')
        sectionCallback(hotSection)
        
        // 3. Top Rated - Normal
        const topRatedSection = App.createHomeSection({ 
            id: 'top_rated', 
            title: 'Top Rated ⭐', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        // Selettore specifico basato sul contenitore genitore
        topRatedSection.items = this.parseGridItems($, 'div.side-block:has(h2:contains("Top-rated")) a.popular')
        sectionCallback(topRatedSection)

        // 4. Just Added - Normal
        const justAddedSection = App.createHomeSection({ 
            id: 'just_added', 
            title: 'Just Added 🆕', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        justAddedSection.items = this.parseGridItems($, 'div.side-block:has(h2:contains("Just added")) a.popular')
        sectionCallback(justAddedSection)

        // 5. Latest Updates - Continuous (Verticale Infinito)
        // NOTA: Cambio UX importante. 'continuous' permette all'utente di scrollare
        // senza dover entrare in una vista separata subito.
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆙', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })
        // Qui passiamo il selettore del sottotitolo per vedere il capitolo
        latestSection.items = this.parseGridItems($, '.sect--latest .latest', '.latest__chapter')
        sectionCallback(latestSection)
    }

    // Usato sia per Search che per ViewMore
    parseSearchResults($: any): PartialSourceManga[] {
        // Usa il selettore generico della pagina search/list
        return this.parseGridItems($, '.readed')
    }
}