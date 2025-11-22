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

    // HELPER AVANZATO PER IMMAGINI
    private getImageSrc(element: any): string {
        // 1. Cerca il tag img dentro l'elemento
        let img = element.find('img').first()
        
        // 2. Se l'elemento stesso è un'immagine, usa quello
        if (element.is('img')) img = element

        // 3. Leggi tutti i possibili attributi usati da NineManga
        let src = img.attr('src') || img.attr('data-src') || img.attr('original') || img.attr('data-original') || img.attr('srcset')

        // 4. Fallback se non trova nulla
        if (!src) return 'https://paperback.moe/icons/logo-alt.svg'

        // 5. Pulizia URL
        src = src.trim()
        
        // Corregge URL relativi o senza protocollo
        if (src.startsWith('//')) {
            src = `https:${src}`
        } else if (src.startsWith('/')) {
            src = `https://it.ninemanga.com${src}`
        } else if (src.startsWith('http:')) {
            // Forza HTTPS (iOS spesso blocca immagini http miste)
            src = src.replace('http:', 'https:')
        }

        return src
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // 1. TITOLO
        let title = $('h1[itemprop="name"]').text().trim()
        if (!title) title = $('.book-title').text().trim()
        if (!title) title = $('h1').first().text().trim()
        title = title.replace(/ Manga$/, '').trim() // Pulizia "Nome Manga" -> "Nome"
        
        // 2. IMMAGINE (Cerca in più posti)
        // Priorità: img con itemprop="image" -> img dentro .bookintro -> img dentro .bookface
        let imageElement = $('img[itemprop="image"]').first()
        if (imageElement.length === 0) imageElement = $('.bookintro img').first()
        if (imageElement.length === 0) imageElement = $('.bookface img').first()
        if (imageElement.length === 0) imageElement = $('.manga-cover img').first()
        
        const image = this.getImageSrc(imageElement)

        // 3. AUTORE
        const author = $('a[itemprop="author"]').first().text().trim() || 'Unknown'
        const artist = author 

        // 4. DESCRIZIONE
        // Cerca il tag p con itemprop="description" OVUNQUE nella pagina
        let desc = $('p[itemprop="description"]').text().trim()
        
        // Fallback: cerca testo dentro .bookintro rimuovendo i figli (come i tag <b> o <ul>)
        if (!desc) {
            const intro = $('.bookintro').clone()
            intro.find('ul, h1, div, a').remove() // Rimuovi elementi non-descrizione
            desc = intro.text().trim()
        }
        
        if (!desc) desc = 'No description available'
        // Pulizia: rimuove "Sommario:" se presente all'inizio
        desc = desc.replace(/^Sommario:\s*/i, '')
        
        // 5. STATUS
        let status = 'Ongoing'
        // Cerca link che contengono 'completed' o testo rosso
        const statusText = $('.red, a[href*="completed"]').text().toLowerCase()
        if (statusText.includes('completato') || statusText.includes('completed')) status = 'Completed'

        // 6. GENERI
        const arrayTags: Tag[] = []
        const genreLinks = $('li[itemprop="genre"] a').toArray()
        for (const el of genreLinks) {
            const $el = $(el)
            const id = $el.attr('href')?.split('/').pop()?.replace('.html', '') ?? ''
            const label = $el.text().trim()
            if (id && label) arrayTags.push({ id, label })
        }
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

        // Cerca i link con classe specifica (metodo preciso) O qualsiasi link con /chapter/ (fallback)
        let chapterLinks = $('a.chapter_list_a').toArray()
        if (chapterLinks.length === 0) {
            chapterLinks = $('a[href*="/chapter/"]').toArray()
        }

        for (const link of chapterLinks) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            // Estrazione ID pulita
            const parts = href.split('/')
            const filePart = parts.pop() ?? '' 
            const chapterId = filePart.split('?')[0].replace('.html', '')

            // Filtri di sicurezza
            if (seenIds.has(chapterId)) continue
            // Ignora link di paginazione (es: 1234-10-1.html) che sono pagine interne del capitolo
            if (filePart.match(/-\d+-\d+\.html$/)) continue 

            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            // Rimuovi il nome del manga dal titolo del capitolo per pulizia
            titleRaw = titleRaw.replace(new RegExp(`^${mangaId.replace(/-/g, ' ')}\\s+`, 'i'), '')
            titleRaw = titleRaw.replace(mangaId, '').trim()

            // Data
            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            if (dateText) {
                time = new Date(dateText)
                if (isNaN(time.getTime())) time = new Date()
            }

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

    parseChapterDetails($: any, mangaId: string, chapterId: string, requestManager: any, baseUrl: string, cheerio: any): ChapterDetails {
        const pages: string[] = []
        let foundInScript = false
        
        // 1. Estrazione da Script (Metodo Veloce)
        const scripts = $('script').toArray()
        for (const script of scripts) {
            const content = $(script).html()
            if (content && (content.includes('p_urls') || content.includes('img_url'))) {
                // Cerca URL completi che finiscono con estensioni immagine
                const matches = content.match(/(https?:\/\/[^"']+\.(?:jpg|png|webp|jpeg))/gi)
                if (matches && matches.length > 0) {
                    for(const m of matches) pages.push(m)
                    foundInScript = true
                    break
                }
            }
        }

        // 2. Estrazione da DOM (Fallback)
        if (!foundInScript) {
            const imgElements = $('img.manga_pic').toArray()
            for (const img of imgElements) {
                const src = $(img).attr('src')
                if (src) pages.push(src)
            }
            
            if (pages.length === 0) {
                 const centerImages = $('div[align="center"] img').toArray()
                 for (const img of centerImages) {
                    const src = $(img).attr('src')
                    if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
                        pages.push(src)
                    }
                }
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)] // Rimuovi duplicati
        })
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // SELETTORI RICERCA: 
        // Mobile search usa spesso <dl> con <dt>(img) e <dd>(testo)
        const items = $('.book-list li, .comic-item, dl.book-list').toArray()

        for (const item of items) {
            const $item = $(item)
            
            // Cerca il link del titolo
            let link = $item.find('dd a').first() // Struttura DL
            if (link.length === 0) link = $item.find('a.bookname').first() // Struttura LI
            if (link.length === 0) link = $item.find('a').last() // Fallback generico

            const href = link.attr('href')
            // Estrai ID: /manga/Nome-Manga.html -> Nome-Manga
            const id = href?.split('/manga/')[1]?.replace('.html', '')

            if (!id) continue

            // Cerca Immagine (Helper gestisce lazy load e https)
            const image = this.getImageSrc($item)
            
            let title = link.text().trim()
            if (!title) title = link.attr('title') ?? 'Unknown'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        }
        return results
    }

    parseHomeSections($home: any, $updates: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const newSection = App.createHomeSection({ id: 'new', title: 'Nuove Uscite', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Ultimi Aggiornamenti', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const popularItems: PartialSourceManga[] = []
        const newItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        const cleanTitle = (t: string) => t.replace(/(\s+(Vol\.|Ch\.|Chapter\.)?\s*\d+(\.\d+)?)+$/i, '').trim()

        // Helper comune per estrarre da liste home
        const parseList = (selector: string, targetArray: PartialSourceManga[], subtitlePrefix: string | undefined) => {
            const list = $home(selector).toArray()
            for (const item of list) {
                const $item = $home(item)
                const link = $item.find('a').first()
                const href = link.attr('href')
                const id = href?.split('/manga/')[1]?.replace('.html', '')
                
                if (!id) continue

                // Usa helper immagine
                const image = this.getImageSrc($item)
                
                const rawTitle = link.attr('title') || $item.find('span').text().trim()
                const title = cleanTitle(rawTitle)
                
                let subtitle = undefined
                if (subtitlePrefix) {
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