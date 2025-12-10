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

import * as cheerio from 'cheerio'

export class NineMangaITParser {

    // HELPER: Pulisce e corregge gli URL delle immagini
    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        if (element.is('img')) img = element

        let src = img.attr('src') || img.attr('data-src') || img.attr('original') || img.attr('data-original')
        
        if (!src || src.includes('logo-alt')) return 'https://paperback.moe/icons/logo-alt.svg'

        src = src.trim()
        // Correzione protocolli e domini
        if (src.startsWith('//')) src = `https:${src}`
        else if (src.startsWith('/')) src = `https://it.ninemanga.com${src}`
        
        return src
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Tenta diversi selettori per il titolo
        let title = $('h1[itemprop="name"]').first().text().trim()
        if (!title) title = $('.book-title').text().trim()
        if (!title) title = $('h1').first().text().trim()
        // Rimuove la scritta "Manga" finale se presente
        title = title.replace(/ Manga$/, '').trim()
        
        // Immagine copertina
        let imageElement = $('img[itemprop="image"]').first()
        if (imageElement.length === 0) imageElement = $('.bookintro img').first()
        if (imageElement.length === 0) imageElement = $('.manga-cover img').first()
        
        const image = this.getImageSrc(imageElement)

        const author = $('a[itemprop="author"]').first().text().trim() || 'Unknown'
        const artist = author 

        // Descrizione
        let desc = $('p[itemprop="description"]').text().trim()
        if (!desc) {
            const intro = $('.bookintro').clone()
            intro.find('ul, h1, div, a').remove() 
            desc = intro.text().trim()
        }
        desc = desc.replace(/^Sommario:\s*/i, '')
        if (!desc) desc = 'Nessuna descrizione disponibile.'
        
        // Status
        let status = 'Ongoing'
        const statusText = $('.red, a[href*="completed"]').text().toLowerCase()
        if (statusText.includes('completato') || statusText.includes('completed')) status = 'Completed'

        // Tags (Fix per l'errore "Invalid type")
        const arrayTags: Tag[] = []
        $('li[itemprop="genre"] a').each((_: any, el: any) => {
            const $el = $(el)
            const id = $el.attr('href')?.split('/').pop()?.replace('.html', '')
            const label = $el.text().trim()
            
            // Creiamo il tag SOLO se abbiamo dati validi, usando App.createTag
            if (id && label) {
                arrayTags.push(App.createTag({ id: id, label: label }))
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
                desc: desc,
                tags: tagSections
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenIds = new Set<string>()

        // Cerca i link ai capitoli
        let chapterLinks = $('a.chapter_list_a').toArray()
        // Fallback per layout alternativi
        if (chapterLinks.length === 0) {
            chapterLinks = $('ul.sub_vol_ul li a').toArray()
        }

        for (const link of chapterLinks) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            // Estrai ID pulito (togli .html e query params)
            const parts = href.split('/')
            const filePart = parts.pop() ?? '' 
            const chapterId = filePart.split('?')[0].replace('.html', '')

            // Evita duplicati e pagine interne (es. ...-10-1.html)
            if (seenIds.has(chapterId)) continue
            if (filePart.match(/-\d+-\d+\.html$/)) continue 

            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            // Pulisci il titolo rimuovendo il nome del manga
            const mangaNameClean = mangaId.replace(/-/g, ' ')
            titleRaw = titleRaw.replace(new RegExp(`^${mangaNameClean}\\s+`, 'i'), '')
            titleRaw = titleRaw.replace(mangaId, '').trim()

            // Data
            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            if (dateText) {
                time = new Date(dateText)
                if (isNaN(time.getTime())) time = new Date()
            }

            // Numero capitolo
            const chapNumMatch = titleRaw.match(/(?:ch|chapter|episode|c)\.?\s*(\d+(\.\d+)?)/i)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1] ?? '0')
            } else {
                const simpleNums = titleRaw.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1] ?? '0')
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: titleRaw || 'Capitolo ' + chapNum,
                chapNum: chapNum,
                time: time,
                langCode: 'it'
            }))
        }
        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        const $ = cheerio.load(html)
        
        // 1. Metodo Principale: Cerca immagini nel DOM (funziona con ?style=list e Desktop UserAgent)
        // NineManga Desktop usa spesso 'img.manga_pic' o immagini dentro un center/div
        $('img.manga_pic').each((_: any, img: any) => {
             const src = $(img).attr('src')
             if (src) pages.push(src)
        })

        // 2. Fallback: Cerca in div generici se il selettore sopra fallisce
        if (pages.length === 0) {
             $('div.pic_box img, div[align="center"] img').each((_: any, img: any) => {
                const src = $(img).attr('src')
                // Filtra icone e loghi
                if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon') && !src.includes('button')) {
                    pages.push(src)
                }
            })
        }
        
        // 3. Fallback Estremo: Cerca URL immagini negli script (solo se i metodi DOM falliscono)
        if (pages.length === 0) {
             const scripts = $('script').toArray()
             for (const script of scripts) {
                 const content = $(script).html()
                 if (content && (content.includes('p_urls') || content.includes('img_url'))) {
                     // Cerca array di URL o URL singoli
                     const matches = content.match(/(https?:\/\/[^"']+\.(?:jpg|png|webp|jpeg))/gi)
                     if (matches && matches.length > 0) {
                         for(const m of matches) pages.push(m)
                     }
                 }
             }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)] // Rimuove duplicati
        })
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        // Selettori "a strascico" per catturare vari layout
        const items = $('.book-list li, .direlist .bookinfo, dl, .comic-item').toArray()

        for (const item of items) {
            const $item = $(item)
            const link = $item.find('a[href*="/manga/"]').first()
            const href = link.attr('href')
            
            if (!href) continue

            const id = href.split('/manga/')[1]?.replace('.html', '')
            if (!id) continue

            const image = this.getImageSrc($item)

            let title = link.text().trim()
            if (!title) title = link.attr('title') ?? ''
            if (!title) title = $item.find('b, h3, dd.book-list').text().trim()
            if (!title) title = 'Unknown'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        }
        return results
    }

    parseHomeSections($home: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        
        // Sezione Popolari (Grande)
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Popolari 🔥', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowLarge 
        })

        // Sezione Nuove Uscite
        const newSection = App.createHomeSection({ 
            id: 'new', 
            title: 'Nuove Uscite 🆕', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })

        // Sezione Ultimi Aggiornamenti
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Ultimi Aggiornamenti 🆙', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal 
        })

        const popularItems: PartialSourceManga[] = []
        const newItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        const cleanTitle = (t: string) => t.replace(/(\s+(Vol\.|Ch\.|Chapter\.)?\s*\d+(\.\d+)?)+$/i, '').trim()

        const parseList = (selector: string, targetArray: PartialSourceManga[], subtitlePrefix: string | undefined) => {
            const list = $home(selector).toArray()
            for (const item of list) {
                const $item = $home(item)
                const link = $item.find('a').first()
                const href = link.attr('href')
                const id = href?.split('/manga/')[1]?.replace('.html', '')
                
                if (!id) continue

                const image = this.getImageSrc($item)
                
                const rawTitle = link.attr('title') || $item.find('span').text().trim()
                const title = cleanTitle(rawTitle)
                
                let subtitle = undefined
                if (subtitlePrefix) {
                     // Cerca numeri alla fine del titolo per il sottotitolo
                     const numMatch = rawTitle.match(/(\d+(\.\d+)?)$/)
                     if (numMatch) subtitle = `Ch. ${numMatch[0]}`
                }

                targetArray.push(App.createPartialSourceManga({ 
                    mangaId: id, 
                    image: image, 
                    title: title, 
                    subtitle: subtitle 
                }))
            }
        }

        // Popola le sezioni
        parseList('#tab_content_3 li', popularItems, undefined)
        popularSection.items = popularItems
        sectionCallback(popularSection)

        parseList('#tab_content_1 li', newItems, undefined)
        newSection.items = newItems
        sectionCallback(newSection)

        parseList('#tab_content_2 li', latestItems, 'Ch.')
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }
}