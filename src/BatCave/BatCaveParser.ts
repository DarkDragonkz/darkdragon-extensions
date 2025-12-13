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

    private getHighResImage(url: string | undefined): string {
        if (!url) return ''
        if (url.startsWith('/')) url = BASE_URL + url
        if (url.includes('/thumbs/')) url = url.replace('/thumbs/', '/')
        return url
    }

    parseGridItems($: any, selector: string, subtitleSelector?: string): PartialSourceManga[] {
        const items: PartialSourceManga[] = []
        
        $(selector).each((_: any, item: any) => {
            const link = $(item).is('a') ? $(item) : $('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/').pop()
            
            const title = $('.poster__title, .latest__title a, .readed__title a, .popular__title', item).first().text().trim() || link.text().trim()
            const rawImage = $('img', item).attr('data-src') ?? $('img', item).attr('src')
            const image = this.getHighResImage(rawImage)

            let subtitle: string | undefined = undefined
            if (subtitleSelector) {
                const subText = $(subtitleSelector, item).text().trim()
                subtitle = subText.replace(/chapter\s*/i, 'Ch. ').trim()
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
        const rawImage = $('.page__poster img').attr('src')
        const image = this.getHighResImage(rawImage)
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
            const hrefParts = $(a).attr('href')?.split('/')
            const id = hrefParts ? hrefParts[hrefParts.length - 2] : label
            if (label) arrayTags.push(App.createTag({ id: id ?? label, label }))
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
        const scriptData = html.match(/window\.__DATA__\s*=\s*({.*?});/s)
        if (!scriptData) return []

        try {
            const data = JSON.parse(scriptData[1])
            if (data.chapters && Array.isArray(data.chapters)) {
                for (const chap of data.chapters) {
                    const id = String(chap.id)
                    let rawTitle = (chap.title || '').trim()
                    
                    // --- CALCOLO NUMERO CAPITOLO ---
                    let chapNum = 0
                    if (chap.posi) {
                        chapNum = parseFloat(chap.posi)
                    } else {
                        const numMatch = rawTitle.match(/(\d+(\.\d+)?)/g)
                        if (numMatch) chapNum = parseFloat(numMatch[numMatch.length - 1] ?? '0')
                    }

                    // --- PIPELINE DI PULIZIA DEL TITOLO ---
                    // 1. Estrazione e rimozione dell'anno (es. (2025-))
                    let yearSuffix = ''
                    const yearMatch = rawTitle.match(/\(\d{4}-?\)/)
                    if (yearMatch) {
                        yearSuffix = ` ${yearMatch[0]}` // Conserviamo lo spazio prima
                        rawTitle = rawTitle.replace(yearMatch[0], '')
                    }

                    // 2. Rimozione "Chapter X" o "Ch. X" ridondante all'inizio
                    // Rimuove "Chapter 1 -", "Ch. 1 -", "Chapter 1"
                    const redundantPrefixRegex = new RegExp(`^(chapter|ch\\.?)\\s*${chapNum}\\s*[-–—]?\\s*`, 'i')
                    rawTitle = rawTitle.replace(redundantPrefixRegex, '')

                    // 3. Gestione Hashtag (#TheFlash -> The Flash)
                    // Rimuove il cancelletto e opzionalmente aggiunge spazio tra CamelCase (es. TheFlash -> The Flash)
                    // Qui facciamo una rimozione semplice del # e pulizia
                    rawTitle = rawTitle.replace(/#/g, '')
                    
                    // 4. Pulizia generale (doppi spazi, trattini inizio/fine)
                    // Rimuove anche "DC-Marvel" se vuoi pulire editori noti, ma per ora puliamo la sintassi
                    let cleanTitle = rawTitle
                        .replace(/\s+/g, ' ')          // Normalizza spazi
                        .replace(/^[-–—]\s*/, '')      // Rimuove trattini iniziali
                        .replace(/\s*[-–—]$/, '')      // Rimuove trattini finali
                        .trim()

                    // Se dopo la pulizia il titolo è vuoto o è solo simboli, fallback
                    if (!cleanTitle || cleanTitle.length < 2) {
                        cleanTitle = ''
                    }

                    // 5. Costruzione Finale: Ch. 1 - Titolo (2025-)
                    let finalName = `Ch. ${chapNum}`
                    if (cleanTitle) {
                        finalName += ` - ${cleanTitle}`
                    }
                    if (yearSuffix) {
                        finalName += yearSuffix
                    }
                    // ----------------------------------------

                    let time = new Date()
                    if (chap.date) {
                        const parts = chap.date.split('.')
                        if (parts.length === 3) {
                            time = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                        } else {
                            const tryDate = new Date(chap.date)
                            if (!isNaN(tryDate.getTime())) time = tryDate
                        }
                    }

                    chapters.push(App.createChapter({
                        id: id,
                        name: finalName,
                        chapNum: chapNum,
                        time: time,
                        langCode: 'en'
                    }))
                }
            }
        } catch (e) {
            console.error(`BatCave: Error parsing chapters JSON: ${e}`)
        }

        return chapters.sort((a, b) => b.chapNum - a.chapNum)
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
                console.error(`BatCave: Error parsing images JSON: ${e}`)
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const featuredSection = App.createHomeSection({ 
            id: 'featured', 
            title: 'Featured Comics 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })
        featuredSection.items = this.parseGridItems($, '.sect--popular .poster')
        sectionCallback(featuredSection)

        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot New Releases ⚡', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        hotSection.items = this.parseGridItems($, '.sect--hot .poster')
        sectionCallback(hotSection)
        
        const topRatedSection = App.createHomeSection({ 
            id: 'top_rated', 
            title: 'Top Rated ⭐', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        topRatedSection.items = this.parseGridItems($, 'div.side-block:has(h2:contains("Top-rated")) a.popular')
        sectionCallback(topRatedSection)

        const justAddedSection = App.createHomeSection({ 
            id: 'just_added', 
            title: 'Just Added 🆕', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        justAddedSection.items = this.parseGridItems($, 'div.side-block:has(h2:contains("Just added")) a.popular')
        sectionCallback(justAddedSection)

        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆙', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })
        latestSection.items = this.parseGridItems($, '.sect--latest .latest', '.latest__chapter')
        sectionCallback(latestSection)
    }

    parseSearchResults($: any): PartialSourceManga[] {
        let results = this.parseGridItems($, '.readed') 
        if (results.length === 0) {
            results = this.parseGridItems($, '.sect--latest .latest')
        }
        return results
    }
}