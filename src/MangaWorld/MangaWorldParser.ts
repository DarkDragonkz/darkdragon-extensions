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
        const id_arr: Array<string> = []
        const label_arr: Array<string> = []
        
        $('.meta-data.row.px-1 .col-12').each((i: number, obj: any) => {
            switch (i) {
                case 1:
                    $(obj).find('a').each((_: any, e: any) => {
                            label_arr.push($(e).text())
                            id_arr.push($(e).attr('href')?.replace('https://www.mangaworld.mx/archive?genre=', '') ?? '')
                        })
                    break
                case 2:
                    author = $(obj).text().trim().replace('Autore: ', '')
                    break
                case 3:
                    artist = $(obj).text().trim().replace('Artista: ', '')
                    break
            }
        })

        const status = 'Ongoing'
        const arrayTags: Tag[] = []

        for (const j in label_arr) {
            const id = id_arr[j] ?? ''
            const label = label_arr[j] ?? ''
            if (['ADULTI', 'SMUT', 'MATURO', 'HENTAI'].includes(id.toUpperCase())) hentai = true
            if (!id || !label) continue
            arrayTags.push({ id: id, label: label })
        }

        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags.map((x) => App.createTag(x)) })]
        
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
        const arrChapters = $('.chapter').toArray().reverse() 
        for (const item of arrChapters) {
            const id = $('a', item).attr('href')?.replace(`${BASE_URL}/manga/${mangaId}/read/`, '') ?? ''
            const name = $('a', item).attr('title') ?? ''
            const chapNum = Number($('.d-inline-block', item).text().split(' ')[1]) ?? -1

            chapters.push(
                App.createChapter({
                    id,
                    name,
                    chapNum: chapNum >= 0 ? chapNum : 0,
                    time: new Date(),
                    langCode: 'it',
                })
            )
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
        
        // 1. Manga del Mese (Featured Large, View More)
        const sectionMangaMese = App.createHomeSection({
            id: 'manga_mese',
            title: 'Manga del Mese 🌟',
            containsMoreItems: true,
            type: HomeSectionType.singleRowLarge
        })

        // 2. Capitoli di Tendenza (Normal)
        const sectionTrending = App.createHomeSection({
            id: 'tendenza',
            title: 'Capitoli di Tendenza 📈',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })

        // 3. Ultime Aggiunte (Normal)
        const sectionAdded = App.createHomeSection({
            id: 'ultime_aggiunte',
            title: 'Ultime Aggiunte 🆕',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })

        // 4. Ultimi Capitoli (Normal, View More)
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

        // --- Parsing Manga del Mese ---
        // Selettore specifico: prendiamo il div .long che è nascosto ma contiene l'immagine
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

        // --- Parsing Capitoli di Tendenza ---
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

        // --- Parsing Ultime Aggiunte ---
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

        // --- Parsing Ultimi Capitoli ---
        // Escludiamo quelli dentro latest-manga per non duplicare se i selettori si sovrappongono
        $('.comics-grid .entry').each((_: any, item: any) => {
            if ($(item).parents('.latest-manga').length > 0) return

            const link = $('a.thumb', item)
            const href = link.attr('href')
            const id = href?.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0]
            
            let title = $(item).attr('title') 
            if (!title) title = $('.name', item).text().trim()
            
            let image = $('img', link).attr('src') ?? ''
            // Lazy load check
            if (image.includes('loading') || !image || image.startsWith('data:')) {
                image = $('img', link).attr('data-src') ?? $('img', link).attr('data-original') ?? ''
            }
            if (image && image.startsWith('/')) image = BASE_URL + image

            // Ultimo capitolo
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