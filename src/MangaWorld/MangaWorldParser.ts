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
        
        // --- 1. Manga del Mese ---
        const section2 = App.createHomeSection({
            id: '2',
            title: 'Manga del Mese 🌟',
            containsMoreItems: true,
            type: HomeSectionType.singleRowLarge // <--- CAMBIATO: Ora le copertine sono intere e grandi
        })

        // --- 2. Ultimi Capitoli ---
        const section1 = App.createHomeSection({
            id: '1',
            title: 'Ultimi Capitoli 🔥',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal,
        })

        // --- 3. Capitoli di Tendenza ---
        const section3 = App.createHomeSection({
            id: '3',
            title: 'In Tendenza 📈',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal,
        })

        const latestManga: PartialSourceManga[] = []
        const hotTitles: PartialSourceManga[] = []
        const trending: PartialSourceManga[] = []

        const arrLatest = $('.col-sm-12.col-md-8.col-xl-9 .comics-grid .entry').toArray()
        const arrHotTitle = $('.col-12 .top-wrapper .entry').toArray()
        const arrTrending = $('.entry.vertical').toArray()

        const processEntry = (obj: any, source: string) => {
            const href = $('a', obj).attr('href') ?? ''
            const id = href.match(/[0-9]+\/[a-zA-Z0-9\-]+/i)?.[0] ?? ''
            
            const imgElement = $('a img', obj)
            let image = imgElement.attr('src') ?? ''
            
            if (image.includes('loading') || !image || image.startsWith('data:')) {
                image = imgElement.attr('data-src') ?? imgElement.attr('data-original') ?? ''
            }
            if (image && image.startsWith('/')) {
                image = BASE_URL + image
            }

            let title = $('a', obj).attr('title') 
            if (!title) title = $('.name', obj).text().trim()
            if (!title) title = $('.manga-title', obj).text().trim()
            title = this.cleanTitle(title ?? 'Unknown')

            let sub = ''
            if (source === 'latest') {
                sub = $('.d-flex.flex-wrap.flex-row a', obj).first().attr('title') ?? ''
            }
            
            return App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: sub,
            })
        }

        // Popola Hot Titles
        let i = 0
        for (const obj of arrHotTitle) {
            hotTitles.push(processEntry(obj, 'hot'))
            i++
            if (i >= 10) break 
        }
        section2.items = hotTitles
        sectionCallback(section2)

        // Popola Latest
        for (const obj of arrLatest) {
            latestManga.push(processEntry(obj, 'latest'))
        }
        section1.items = latestManga
        sectionCallback(section1)

        // Popola Trending
        for (const obj of arrTrending) {
            trending.push(processEntry(obj, 'trending'))
        }
        section3.items = trending
        sectionCallback(section3)
    }

    parseViewMore($: any): PartialSourceManga[] {
        const more: PartialSourceManga[] = []
        const arrLatest = $('.comics-grid .entry').toArray()
        
        for (const obj of arrLatest) {
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