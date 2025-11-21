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

export class Parser {
    parseMangaDetails($: any, mangaId: string, source: any): SourceManga {
        const title = $('.bookface img').attr('alt') ?? ''
        
        let image = $('.bookface img').attr('src') ?? ''
        if (!image || image.includes('logo-alt')) {
            image = $('.bookface img').attr('data-src') ?? 'https://paperback.moe/icons/logo-alt.svg'
        }
        
        let desc = $('.bookintro p').text().trim().replace('Summary:', '') ?? ''
        if (desc == '') desc = `No Description provided by the source(${source.baseUrl})`
        let author = ''
        let status_str = ''
        let hentai = false
        const arrayTags: Tag[] = []
        const info = $('.message li').toArray()
        for (const obj of info) {
            const item = $('b', obj).text().trim().replace(':', '')
            switch (item) {
                case source.genreTag:
                    for (const e of $('a', obj).toArray()) {
                        const id = $(e).attr('href')?.replace('/category/', '').replace('.html', '') ?? ''
                        const label = $(e).text().trim() ?? ''
                        if (['ADULT', 'SMUT', 'MATURE'].includes(id.toUpperCase())) hentai = true
                        if (!id || !label) continue
                        arrayTags.push({ id: id, label: label })
                    }
                    break
                case source.authorTag:
                    author = $('a', obj).text().trim()
                    break
                case source.statusTag:
                    status_str = $('a', obj).first().text().trim()
                    break
            }
        }
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map((x) => App.createTag(x)) })]
        const status = source.parseStatus(status_str)
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                rating: 0,
                status,
                author,
                tags: tagSections,
                desc,
                hentai,
            }),
        })
    }

    parseChapters($: any, mangaId: string, source: any): Chapter[] {
        const chapters: Chapter[] = []
        let prevChapNum = 1
        const arrChapters = $('.sub_vol_ul li').toArray().reverse()
        for (const obj of arrChapters) {
            const id = $('a', obj).attr('href')?.replace('.html', '').replace(/\/$/, '') ?? ''
            const name = $('a', obj).attr('title') ?? ''
            const chapNum = prevChapNum++
            const time = source.convertTime($('span', obj).text().trim())
            chapters.push(
                App.createChapter({
                    id,
                    name,
                    chapNum,
                    time,
                    langCode: source.languageCode,
                })
            )
        }
        return chapters
    }

    async parseChapterDetails($: any, mangaId: string, id: string, source: any): Promise<ChapterDetails> {
        const pages: string[] = []
        const pageArr = $('select#page option').toArray()
        let end = ''
        let i = 0
        for (const obj of pageArr) {
            const page = $(obj).attr('value') ?? ''
            if (i == 0) end = page
            if (i > 0 && page == end) break
            const imagesArray = await this.getImage(`${source.baseUrl}${page}`, source)
            for (const image of imagesArray) pages.push(image)
            i++
        }
        return App.createChapterDetails({
            id,
            mangaId,
            pages,
        })
    }

    parseSearchResults($: any, source: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        for (const obj of $('.direlist .bookinfo').toArray()) {
            const id = $('.bookname', obj).attr('href')?.replace(`${source.baseUrl}/manga/`, '').replace('.html', '') ?? ''
            const title = $('.bookname', obj).text().trim() ?? ''
            const subTitle = $('.chaptername', obj).text().trim().replace(title, '').trim() ?? ''
            
            let image = $('dt img', obj).attr('src') ?? ''
            if (!image) image = $('dt img', obj).attr('data-src') ?? ''

            results.push(
                App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: subTitle,
                })
            )
        }
        return results
    }

    parseTags($: any): TagSection[] {
        const genres: Tag[] = []
        for (const obj of $('div.typelist li.cate_list').toArray()) {
            const id = $(obj).attr('cate_id')
            const label = $(obj).text().trim() ?? ''
            if (!id || !label) continue
            genres.push(App.createTag({ label, id }))
        }
        return [App.createTagSection({ id: '0', label: 'genres', tags: genres })]
    }

    async parseHomeSections($: any, $$: any, sectionCallback: (section: HomeSection) => void, source: any): Promise<void> {
        // 1. IN EVIDENZA (Top Slider)
        const sectionAggiornamenti = App.createHomeSection({ id: 'top_update', title: 'In Evidenza', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        // 2. POPOLARI (Colonna destra)
        const sectionPopolari = App.createHomeSection({ id: 'popular', title: 'Popolari', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        // 3. NUOVE AGGIUNTE (Colonna destra)
        const sectionNuovi = App.createHomeSection({ id: 'new', title: 'Nuove Aggiunte', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        // 4. ULTIMI CARICAMENTI (Lista centrale)
        const sectionRecenti = App.createHomeSection({ id: 'recent', title: 'Ultimi Caricamenti', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const aggiornamenti: PartialSourceManga[] = []
        const popolari: PartialSourceManga[] = []
        const nuovi: PartialSourceManga[] = []
        const recenti: PartialSourceManga[] = []

        // --- PARSING "AGGIORNARE" (Slider in alto) ---
        const arrAggiornamenti = $('.pop_update li').toArray()
        for (const obj of arrAggiornamenti) {
            const href = $('.bookname', obj).attr('href')
            const id = href?.replace(`${source.baseUrl}/manga/`, '').replace('.html', '') ?? ''
            
            let title = $('.bookface', obj).attr('title') ?? ''
            if(!title) title = $('.bookname', obj).text().trim()

            let image = $('.bookface img', obj).attr('src') ?? ''
            
            if (id && title) {
                aggiornamenti.push(App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: 'In Evidenza'
                }))
            }
        }
        sectionAggiornamenti.items = aggiornamenti
        sectionCallback(sectionAggiornamenti)

        // --- PARSING COLONNA DESTRA (Rightbox) ---
        // Se la richiesta usa l'UserAgent Desktop, questa colonna ESISTE.
        const rightBoxLists = $('.rightbox ul')
        
        // Lista 1: Popolari
        if (rightBoxLists.length > 0) {
            const popularList = rightBoxLists.eq(0).find('li').toArray()
            for (const obj of popularList) {
                const link = $('dt a', obj)
                const id = link.attr('href')?.replace(`${source.baseUrl}/manga/`, '').replace('.html', '') ?? ''
                
                let image = $('img', link).attr('src') ?? ''
                let title = $('img', link).attr('alt') ?? ''
                if (!title) title = $('dd a.show_book_desc b', obj).text().trim()

                if (id) {
                    popolari.push(App.createPartialSourceManga({
                        image,
                        title: title,
                        mangaId: id,
                        subtitle: 'Hot'
                    }))
                }
            }
        }
        sectionPopolari.items = popolari
        sectionCallback(sectionPopolari)

        // Lista 2: Nuovi
        if (rightBoxLists.length > 1) {
            const newList = rightBoxLists.eq(1).find('li').toArray()
            for (const obj of newList) {
                const link = $('dt a', obj)
                const id = link.attr('href')?.replace(`${source.baseUrl}/manga/`, '').replace('.html', '') ?? ''
                
                let image = $('img', link).attr('src') ?? ''
                let title = $('img', link).attr('alt') ?? ''
                if (!title) title = $('dd a.show_book_desc b', obj).text().trim()

                if (id) {
                    nuovi.push(App.createPartialSourceManga({
                        image,
                        title: title,
                        mangaId: id,
                        subtitle: 'New'
                    }))
                }
            }
        }
        sectionNuovi.items = nuovi
        sectionCallback(sectionNuovi)

        // --- PARSING "ULTIMI AGGIORNAMENTI" (Centrale) ---
        const arrRecenti = $('.homeupdate li').toArray()
        for (const obj of arrRecenti) {
            const link = $('h1.bookopen a', obj)
            const href = link.attr('href')
            const id = href?.replace(`${source.baseUrl}/manga/`, '').replace('.html', '') ?? ''
            const title = link.text().trim()
            const latestChap = $('dl dt a', obj).text().trim()

            // Fallback icona obbligatorio
            const image = 'https://paperback.moe/icons/logo-alt.svg' 

            if (id && title) {
                recenti.push(App.createPartialSourceManga({
                    image,
                    title: title,
                    mangaId: id,
                    subtitle: latestChap
                }))
            }
        }
        sectionRecenti.items = recenti
        sectionCallback(sectionRecenti)
    }

    filterUpdatedManga($: any, time: Date, ids: string[], source: any): string[] {
        let passedReferenceTimePrior = false
        let passedReferenceTimeCurrent = false
        const updatedManga: string[] = []
        for (const obj of $('.homeupdate li').toArray()) {
            const id = $('a', obj).attr('href')?.replace(`${source.baseUrl}/manga/`, '').replace('.html', '') ?? ''
            let mangaTime: Date
            const timeSelector = $('dd', obj).text().trim() ?? ''
            // eslint-disable-next-line prefer-const
            mangaTime = source.convertTime(timeSelector ?? '')
            // Check if the date is valid, if it isn't we should skip it
            if (!mangaTime.getTime()) continue
            passedReferenceTimeCurrent = mangaTime <= time
            if (!passedReferenceTimeCurrent || !passedReferenceTimePrior) {
                if (ids.includes(id)) {
                    updatedManga.push(id)
                }
            } else break
            if (typeof id === 'undefined') {
                throw new Error(`Failed to parse homepage sections for ${source.baseUrl}/${source.homePage}/`)
            }
            passedReferenceTimePrior = passedReferenceTimeCurrent
        }
        return updatedManga
    }

    async getImage(url: string, source: any): Promise<string[]> {
        const request = source.createRequest(url)
        const response = await source.requestManager.schedule(request, 3)
        const $ = source.cheerio.load(response.data)
        const arrImages: string[] = []
        const img = $('div.pic_box img.manga_pic').toArray()
        for (const obj of img) {
            const i = $(obj).attr('src') ?? ''
            arrImages.push(i)
        }
        return arrImages
    }
}