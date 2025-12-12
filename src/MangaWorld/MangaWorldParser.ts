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

const BASE_URL = 'https://www.mangaworld.mx'

export class MangaWorldParser {

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
        if (!dateStr) return new Date()
        
        dateStr = dateStr.trim().toLowerCase()
        
        const months: { [key: string]: string } = {
            'gennaio': 'January', 'febbraio': 'February', 'marzo': 'March',
            'aprile': 'April', 'maggio': 'May', 'giugno': 'June',
            'luglio': 'July', 'agosto': 'August', 'settembre': 'September',
            'ottobre': 'October', 'novembre': 'November', 'dicembre': 'December'
        }

        for (const [it, en] of Object.entries(months)) {
            if (dateStr.includes(it)) {
                dateStr = dateStr.replace(it, en)
                break
            }
        }

        const date = new Date(dateStr)
        return isNaN(date.getTime()) ? new Date() : date
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('.name.bigger').text().trim() ?? ''
        title = this.cleanTitle(title)
        
        const imgElement = $('.thumb.mb-3.text-center img')
        let image = imgElement.attr('src') ?? ''
        
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = imgElement.attr('data-src') ?? imgElement.attr('data-original') ?? ''
        }
        
        if (image && image.startsWith('/')) {
            image = BASE_URL + image
        }
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        const desc = $('#noidungm').text().trim() ?? ''
        let hentai = false
        let author = ''
        let artist = ''
        let status = 'Ongoing'

        $('.meta-data.row.px-1 .col-12').each((_: any, col: any) => {
            const text = $(col).text().trim()
            
            if (text.includes('Autore:')) {
                author = text.replace('Autore:', '').trim()
            } else if (text.includes('Artista:')) {
                artist = text.replace('Artista:', '').trim()
            } else if (text.includes('Stato:')) {
                const statusText = text.replace('Stato:', '').trim().toLowerCase()
                if (statusText.includes('finito') || statusText.includes('completato')) {
                    status = 'Completed'
                } else if (statusText.includes('corso')) {
                    status = 'Ongoing'
                }
            }
        })

        const arrayTags: Tag[] = []
        $('.meta-data.row.px-1 a[href*="genre="]').each((_: any, a: any) => {
            const id = $(a).attr('href')?.split('genre=')[1]
            const label = $(a).text().trim()
            if (id && label) {
                if (['ADULTI', 'SMUT', 'MATURO', 'HENTAI'].includes(id.toUpperCase())) hentai = true
                // FIX TAGS: Usiamo App.createTag qui
                arrayTags.push(App.createTag({ id: id, label: label }))
            }
        })

        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]
        
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                status,
                artist,
                rating: 0,
                author,
                tags: tagSections,
                desc,
                hentai,
            }),
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        const volumes = $('.volume-element').toArray()
        
        if (volumes.length === 0) {
            // Fallback lista semplice
            const simpleChapters = $('.chapter').toArray()
             for (const node of simpleChapters) {
                 const link = $('a.chap', node)
                 const href = link.attr('href')
                 const chapterId = href?.split('/read/')[1]?.split('/')[0] ?? ''
                 if (!chapterId) continue

                 const rawTitle = link.find('span').first().text().trim()
                 const chapNumMatch = rawTitle.match(/(\d+(\.\d+)?)/)
                 const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

                 const dateText = link.find('.chap-date').text().trim()
                 const time = this.parseDate(dateText)

                 chapters.push(App.createChapter({
                    id: chapterId,
                    name: rawTitle, // Solo il titolo grezzo, l'app aggiungerà Ch. X
                    chapNum: chapNum,
                    time: time,
                    langCode: 'it'
                }))
             }
        } else {
            // Logica Volumi
            for (const vol of volumes) {
                const volName = $(vol).find('.volume-name').text().trim()
                const volNumMatch = volName.match(/Volume\s+(\d+)/i)
                const volNum = volNumMatch ? parseFloat(volNumMatch[1]) : 0

                const chapterNodes = $(vol).find('.chapter').toArray()
                
                for (const node of chapterNodes) {
                    const link = $(node).find('a.chap')
                    const href = link.attr('href')
                    if (!href) continue

                    const chapterId = href.split('/read/')[1]?.split('/')[0] ?? ''
                    if (!chapterId) continue

                    const rawTitle = link.find('span.d-inline-block').text().trim()
                    const chapNumMatch = rawTitle.match(/(\d+(\.\d+)?)/)
                    const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

                    const dateText = link.find('.chap-date').text().trim()
                    const time = this.parseDate(dateText)

                    // FIX TITOLI: Non aggiungiamo manualmente "Vol. X Ch. Y"
                    // Passiamo volNum e chapNum nei metadati, e lasciamo solo il titolo specifico in 'name'
                    // Se rawTitle è solo "Capitolo 123", Paperback mostrerà "Vol. 1 Ch. 123 - Capitolo 123"
                    // che è un po' ridondante ma corretto strutturalmente.
                    // Se vogliamo pulirlo ulteriormente, potremmo rimuovere "Capitolo X" da rawTitle se è uguale a chapNum.
                    
                    let cleanName = rawTitle;
                    // Opzionale: Rimuovi "Capitolo X" se coincide col numero, per avere un titolo più pulito
                    // if (cleanName.match(/^Capitolo\s+\d+$/i)) cleanName = "Capitolo " + chapNum; 

                    chapters.push(App.createChapter({
                        id: chapterId,
                        name: cleanName, 
                        chapNum: chapNum,
                        volume: volNum,
                        time: time,
                        langCode: 'it'
                    }))
                }
            }
        }

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, id: string): ChapterDetails {
        const pages: string[] = []
        for (const item of $('.col-12.text-center.position-relative img').toArray()) {
            let imageUrl = $(item).attr('src')
            if (!imageUrl || imageUrl.includes('loading') || imageUrl.startsWith('data:')) {
                imageUrl = $(item).attr('data-src') ?? $(item).attr('data-original')
            }
            
            if (!imageUrl) continue
            
            if (imageUrl.startsWith('/')) {
                imageUrl = BASE_URL + imageUrl
            }
            
            pages.push(imageUrl.trim())
        }
        return App.createChapterDetails({
            id,
            mangaId,
            pages,
        })
    }

    parseTags($: any, baseUrl: string): TagSection[] {
        const genres: Tag[] = []
        let first_label = ''
        let i = 0
        for (const item of $('.dropdown-menu.dropdown-multicol .dropdown-item').toArray()) {
            const id = $(item).attr('href')?.replace(`${baseUrl}/archive?genre=`, '') ?? ''
            const label = $(item).text().trim()
            if (i == 0) first_label = label
            if (label == first_label && i > 0) break

            genres.push(App.createTag({ label: label, id: id }))
            i++
        }
        return [App.createTagSection({ id: '0', label: 'Generi', tags: genres })]
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        for (const item of $('.comics-grid .entry').toArray()) {
            const href = $('a', item).attr('href') ?? ''
            const id = href.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0] ?? ''

            let title = $('a', item).attr('title') ?? ''
            title = this.cleanTitle(title)
            
            const imgElement = $('a img', item)
            let image = imgElement.attr('src') ?? ''
            
            if (image.includes('loading') || !image || image.startsWith('data:')) {
                image = imgElement.attr('data-src') ?? imgElement.attr('data-original') ?? ''
            }
            if (image && image.startsWith('/')) {
                image = BASE_URL + image
            }
            
            results.push(
                App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: undefined,
                })
            )
        }
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const sectionMangaMese = App.createHomeSection({
            id: 'manga_mese',
            title: 'Manga del Mese 🌟',
            containsMoreItems: true,
            type: HomeSectionType.singleRowLarge
        })

        const sectionTrending = App.createHomeSection({
            id: 'tendenza',
            title: 'Capitoli di Tendenza 📈',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })

        const sectionAdded = App.createHomeSection({
            id: 'ultime_aggiunte',
            title: 'Ultime Aggiunte 🆕',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })

        const sectionLatest = App.createHomeSection({
            id: 'ultimi_capitoli',
            title: 'Ultimi Capitoli 🔥',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        const mangaMese: PartialSourceManga[] = []
        const trendingItems: PartialSourceManga[] = []
        const addedItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        // Manga del Mese
        $('.top-wrapper .entry .long').each((_: any, item: any) => {
            const link = $('a.chap', item).first()
            const href = link.attr('href')
            const id = href?.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]
            
            const title = $('.name', item).text().trim()
            let image = $('.thumb img', item).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                mangaMese.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: this.cleanTitle(title),
                    subtitle: undefined
                }))
            }
        })
        sectionMangaMese.items = mangaMese
        sectionCallback(sectionMangaMese)

        // Capitoli di Tendenza
        $('.entry.vertical').each((_: any, item: any) => {
            const link = $('a.thumb', item)
            const href = link.attr('href')
            const id = href?.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]
            
            const title = $('.manga-title', item).text().trim()
            let image = $('img', link).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image
            
            const chapter = $('.chapter', item).text().trim()

            if (id && title) {
                trendingItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: this.cleanTitle(title),
                    subtitle: chapter
                }))
            }
        })
        sectionTrending.items = trendingItems
        sectionCallback(sectionTrending)

        // Ultime Aggiunte
        $('.latest-manga .entry').each((_: any, item: any) => {
            const link = $('a.thumb', item)
            const href = link.attr('href')
            const id = href?.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]
            
            const title = $('.name', item).text().trim()
            let image = $('img', link).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            if (id && title) {
                addedItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: this.cleanTitle(title),
                    subtitle: 'Nuovo'
                }))
            }
        })
        sectionAdded.items = addedItems
        sectionCallback(sectionAdded)

        // Ultimi Capitoli
        $('.comics-grid .entry').each((_: any, item: any) => {
            if ($(item).parents('.latest-manga').length > 0) return

            const link = $('a.thumb', item)
            const href = link.attr('href')
            const id = href?.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]
            
            let title = $(item).attr('title') 
            if (!title) title = $('.name', item).text().trim()
            
            let image = $('img', link).attr('src') ?? ''
            if (image.includes('loading') || !image || image.startsWith('data:')) {
                image = $('img', link).attr('data-src') ?? $('img', link).attr('data-original') ?? ''
            }
            if (image && image.startsWith('/')) image = BASE_URL + image

            const latestChap = $('.chapters a', item).first().text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: this.cleanTitle(title),
                    subtitle: latestChap
                }))
            }
        })
        sectionLatest.items = latestItems
        sectionCallback(sectionLatest)
    }

    parseViewMore($: any): PartialSourceManga[] {
        const more: PartialSourceManga[] = []
        const items = $('.comics-grid .entry').toArray()
        
        for (const obj of items) {
            const href = $('a', obj).attr('href') ?? ''
            const id = href.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0] ?? ''

            let title = $('a', obj).attr('title') ?? ''
            title = this.cleanTitle(title)
            
            const imgElement = $('a img', obj)
            let image = imgElement.attr('src') ?? ''
            
            if (image.includes('loading') || !image || image.startsWith('data:')) {
                image = imgElement.attr('data-src') ?? imgElement.attr('data-original') ?? ''
            }
            if (image && image.startsWith('/')) {
                image = BASE_URL + image
            }

            const sub = $('.d-flex.flex-wrap.flex-row a', obj).first().attr('title') ?? ''

            more.push(
                App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: sub,
                })
            )
        }
        return more
    }
}