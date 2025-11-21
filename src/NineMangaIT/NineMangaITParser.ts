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

export class NineMangaITParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('.bookface img').attr('alt') ?? ''
        
        let image = $('.bookface img').attr('src') ?? ''
        if (!image || image.includes('logo-alt')) {
            image = $('.bookface img').attr('data-src') ?? 'https://paperback.moe/icons/logo-alt.svg'
        }
        
        let desc = $('.bookintro p').text().trim().replace('Summary:', '') ?? ''
        if (desc === '') desc = 'Nessuna descrizione disponibile.'
        
        let author = ''
        let status_str = ''
        let hentai = false
        const arrayTags: Tag[] = []

        const info = $('.message li').toArray()
        for (const obj of info) {
            const item = $('b', obj).text().trim().replace(':', '')
            switch (item) {
                case 'Genere(s)':
                    for (const e of $('a', obj).toArray()) {
                        const id = $(e).attr('href')?.replace('/category/', '').replace('.html', '') ?? ''
                        const label = $(e).text().trim() ?? ''
                        if (['ADULT', 'SMUT', 'MATURE', 'HENTAI'].includes(id.toUpperCase())) hentai = true
                        if (id && label) arrayTags.push({ id, label })
                    }
                    break
                case 'Author(s)':
                    author = $('a', obj).text().trim()
                    break
                case 'Stato':
                    status_str = $('a', obj).first().text().trim()
                    break
            }
        }

        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags.map(x => App.createTag(x)) })]
        
        let status = 'Ongoing'
        if (status_str.toLowerCase().includes('completato')) status = 'Completed'

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                status,
                author,
                tags: tagSections,
                desc,
                hentai,
            }),
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const arrChapters = $('.sub_vol_ul li').toArray().reverse()
        let prevChapNum = 1

        for (const obj of arrChapters) {
            const link = $('a', obj)
            const id = link.attr('href')?.replace('.html', '').replace(/\/$/, '') ?? ''
            const name = link.attr('title') ?? link.text().trim()
            
            const chapNumRegex = /(\d+(\.\d+)?)/g
            const match = name.match(chapNumRegex)
            let chapNum = prevChapNum
            if (match) {
                chapNum = parseFloat(match[match.length - 1])
            } else {
                prevChapNum++
            }

            const timeStr = $('span', obj).text().trim()
            const time = this.convertTime(timeStr)

            if (id) {
                chapters.push(App.createChapter({
                    id,
                    name,
                    chapNum,
                    time,
                    langCode: 'it',
                }))
            }
        }
        return chapters
    }

    async parseChapterDetails($: any, mangaId: string, id: string, requestManager: any, baseUrl: string, cheerio: any): Promise<ChapterDetails> {
        const pages: string[] = []
        const pageOptions = $('select#page option').toArray()
        
        let firstPageValue = ''
        if (pageOptions.length > 0) {
            firstPageValue = $(pageOptions[0]).attr('value')
        }

        for (const option of pageOptions) {
            const pageUrlRelative = $(option).attr('value')
            if (!pageUrlRelative) continue

            let currentPage$ = $
            if (pageUrlRelative !== firstPageValue) {
                const request = App.createRequest({
                    url: `${baseUrl}${pageUrlRelative}`,
                    method: 'GET',
                    headers: {
                        'referer': `${baseUrl}/`,
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                })
                const response = await requestManager.schedule(request, 1)
                currentPage$ = cheerio.load(response.data)
            }

            const img = currentPage$('div.pic_box img.manga_pic').attr('src')
            if (img) pages.push(img)
        }

        return App.createChapterDetails({
            id,
            mangaId,
            pages,
        })
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        for (const obj of $('.direlist .bookinfo').toArray()) {
            const link = $('.bookname', obj)
            const id = link.attr('href')?.replace(`${baseUrl}/manga/`, '').replace('.html', '')
            const title = link.text().trim()
            const subTitle = $('.chaptername', obj).text().trim()
            
            let image = $('dt img', obj).attr('src')
            if (!image) image = $('dt img', obj).attr('data-src')

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    image: image ?? '',
                    title: title,
                    mangaId: id,
                    subtitle: subTitle ? subTitle : undefined,
                }))
            }
        }
        return results
    }

    parseTags($: any): TagSection[] {
        const genres: Tag[] = []
        for (const obj of $('div.typelist li.cate_list').toArray()) {
            const id = $(obj).attr('cate_id')
            const label = $(obj).text().trim()
            if (id && label) {
                genres.push(App.createTag({ label, id }))
            }
        }
        return [App.createTagSection({ id: '0', label: 'Generi', tags: genres })]
    }

    // FIX: Ora accettiamo anche $updates per la quarta sezione
    parseHomeSections($home: any, $updates: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const secFeatured = App.createHomeSection({ id: 'featured', title: 'In Evidenza', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const secPopular = App.createHomeSection({ id: 'popular', title: 'Popolari', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const secNew = App.createHomeSection({ id: 'new', title: 'Nuove Aggiunte', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const secUpdates = App.createHomeSection({ id: 'recent', title: 'Ultimi Aggiornamenti', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        // 1. In Evidenza (dalla Home)
        const featuredItems: PartialSourceManga[] = []
        $home('.pop_update li').each((_: any, obj: any) => {
            const link = $home('.bookname', obj)
            const id = link.attr('href')?.replace(`${baseUrl}/manga/`, '').replace('.html', '')
            let title = $home('.bookface', obj).attr('title')
            if (!title) title = link.text().trim()
            
            const image = $home('.bookface img', obj).attr('src')

            if (id && title) {
                featuredItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image ?? '',
                    title: title,
                    subtitle: 'Aggiornato'
                }))
            }
        })
        secFeatured.items = featuredItems
        sectionCallback(secFeatured)

        // 2. Popolari & 3. Nuovi (dalla Home)
        const rightBoxLists = $home('.rightbox ul')
        
        // Popolari
        const popularItems: PartialSourceManga[] = []
        if (rightBoxLists.length > 0) {
            rightBoxLists.eq(0).find('li').each((_: any, obj: any) => {
                const link = $home('dt a', obj)
                const id = link.attr('href')?.replace(`${baseUrl}/manga/`, '').replace('.html', '')
                const image = $home('img', link).attr('src')
                let title = $home('img', link).attr('alt')
                if (!title) title = $home('dd a.show_book_desc b', obj).text().trim()

                if (id && title) {
                    popularItems.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image ?? '',
                        title: title,
                        subtitle: 'Hot'
                    }))
                }
            })
        }
        secPopular.items = popularItems
        sectionCallback(secPopular)

        // Nuovi
        const newItems: PartialSourceManga[] = []
        if (rightBoxLists.length > 1) {
            rightBoxLists.eq(1).find('li').each((_: any, obj: any) => {
                const link = $home('dt a', obj)
                const id = link.attr('href')?.replace(`${baseUrl}/manga/`, '').replace('.html', '')
                const image = $home('img', link).attr('src')
                let title = $home('img', link).attr('alt')
                if (!title) title = $home('dd a.show_book_desc b', obj).text().trim()

                if (id && title) {
                    newItems.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image ?? '',
                        title: title,
                        subtitle: 'New'
                    }))
                }
            })
        }
        secNew.items = newItems
        sectionCallback(secNew)

        // 4. Ultimi Aggiornamenti (Dalla pagina UPDATES dedicata)
        // Qui usiamo $updates invece di $home!
        const updateItems: PartialSourceManga[] = []
        $updates('.direlist .bookinfo').each((_: any, obj: any) => {
            const link = $updates('.bookname', obj)
            const id = link.attr('href')?.replace(`${baseUrl}/manga/`, '').replace('.html', '')
            const title = link.text().trim()
            const subTitle = $updates('.chaptername', obj).text().trim()
            
            let image = $updates('dt img', obj).attr('src')
            if (!image) image = $updates('dt img', obj).attr('data-src')

            if (id && title) {
                updateItems.push(App.createPartialSourceManga({
                    image: image ?? '',
                    title: title,
                    mangaId: id,
                    subtitle: subTitle,
                }))
            }
        })
        
        secUpdates.items = updateItems
        sectionCallback(secUpdates)
    }

    private convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = trimmed === 0 && timeAgo.includes('a') ? 1 : trimmed
        
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hours') || timeAgo.includes('hour') || timeAgo.includes('ore')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('days') || timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else {
            time = new Date(timeAgo)
        }
        
        if (isNaN(time.getTime())) return new Date()
        return time
    }
}